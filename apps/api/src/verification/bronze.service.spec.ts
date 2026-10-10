import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { PushService } from "../push/push.service";
import type { StorageService } from "../storage/storage.service";
import { BronzeService, PHOTO_SETTLE_MS, SESSION_EXPIRY_MS } from "./bronze.service";
import { BRONZE_POLICY_VERSION } from "./bronze-policy";
import type { BronzeRepository } from "./bronze.repository";
import type { DiditService } from "./didit.service";
import type { ProfileMatchService } from "./profile-match.service";
import { parseVerificationSettings, VerificationConfig } from "./verification-config";

const NOW = new Date("2026-10-03T12:00:00Z").getTime();
const snapshot = (over: Record<string, unknown> = {}) => ({
  avatarKey: "avatars/u1/a.jpg",
  avatarUploadedAt: new Date(NOW - 60 * 60_000),
  dob: "1998-04-02",
  gender: "female",
  country: "NG",
  nationality: null,
  ...over,
});
const attempt = (over: Record<string, unknown> = {}) => ({
  id: "attempt-1",
  userId: "u1",
  status: "started",
  providerJobId: "didit:s1",
  avatarKey: "avatars/u1/a.jpg",
  profileDob: "1998-04-02",
  profileGender: "female",
  profileCountry: "NG",
  profileNationality: null,
  createdAt: new Date(NOW - 20 * 60_000),
  ...over,
});
/** A Didit decision for session s1 and member u1. */
const decision = (status = "Approved", id: Record<string, unknown> = {}) => ({
  session_id: "s1",
  session_kind: "user",
  vendor_data: "u1",
  workflow_id: "workflow-1",
  status,
  id_verifications: [
    {
      status: "Approved",
      date_of_birth: "1998-04-02",
      gender: "F",
      issuing_state: "NGA",
      issuing_state_name: "Nigeria",
      full_name: "Ada Okafor",
      id_lookup: { outcome: "match", source: "NIMC" },
      ...id,
    },
  ],
  liveness_checks: [{ status: "Approved" }],
  face_matches: [{ status: "Approved" }],
});

function setup(configured = true) {
  const repo = {
    state: vi.fn(async (): Promise<unknown> => null),
    snapshot: vi.fn(async (): Promise<unknown> => snapshot()),
    hasConsent: vi.fn(async () => true),
    consent: vi.fn(async () => undefined),
    withdrawConsent: vi.fn(async () => ["s1", "s2"]),
    diditSessionsOf: vi.fn(async () => ["s1"]),
    reserve: vi.fn(async (): Promise<string | null> => "attempt-1"),
    attempt: vi.fn(async (): Promise<unknown> => attempt()),
    findAttempt: vi.fn(async (): Promise<unknown> => attempt()),
    claimForReconcile: vi.fn(async (): Promise<unknown[]> => []),
    expireAttempt: vi.fn(async () => true),
    bindingUsedElsewhere: vi.fn(async () => false),
    recordCallback: vi.fn(async (): Promise<unknown> => ({
      status: "verified",
      reviewOpened: false,
    })),
    openReviews: vi.fn(async () => []),
    decideReview: vi.fn(async (): Promise<unknown> => ({ ok: true, status: "verified" })),
    revoke: vi.fn(async () => true),
    reopen: vi.fn(async () => true),
  };
  const didit = {
    configured,
    policyUrl: "https://kinkord.test/privacy/verification",
    workflowId: "workflow-1",
    createSession: vi.fn(async () => ({ sessionId: "s1", url: "https://verify.didit.me/s1" })),
    decision: vi.fn(async (): Promise<Record<string, unknown>> => decision()),
    verifyWebhook: vi.fn((body: unknown) => body as Buffer),
    deleteSession: vi.fn(async () => undefined),
  };
  const storage = {
    regenerateVariants: vi.fn(async () => undefined),
    presignReviewDownload: vi.fn(
      async (key: string, v?: string) => `https://review/${key}?${v ?? "original"}`,
    ),
  };
  const profileMatch = {
    evaluate: vi.fn(async (): Promise<unknown> => ({ outcome: "matched", reason: null })),
  };
  const push = { newVerificationReview: vi.fn() };
  const config = VerificationConfig.fixed(
    parseVerificationSettings({ bindingSecret: "b".repeat(40) }),
  );
  const service = new BronzeService(
    repo as unknown as BronzeRepository,
    didit as unknown as DiditService,
    storage as unknown as StorageService,
    profileMatch as unknown as ProfileMatchService,
    push as unknown as PushService,
    config,
  );
  return { service, repo, didit, storage, profileMatch, push };
}

beforeEach(() => vi.useRealTimers());

describe("BronzeService.status", () => {
  it("says so when verification isn't switched on", async () => {
    const { service } = setup(false);
    await expect(service.status("u1", NOW)).resolves.toMatchObject({ available: false });
  });

  it("lists what the profile still needs, and when a new photo can be verified", async () => {
    const { service, repo } = setup();
    repo.snapshot.mockResolvedValueOnce(
      snapshot({ gender: null, avatarUploadedAt: new Date(NOW - 2 * 60_000) }),
    );
    const status = await service.status("u1", NOW);
    expect(status.missing).toEqual(["gender"]);
    expect(status.photoReadyAt).toBe(new Date(NOW - 2 * 60_000 + PHOTO_SETTLE_MS).toISOString());
    expect(status.policyVersion).toBe(BRONZE_POLICY_VERSION);
  });

  it("asks for a new check once the verified birth date changes", async () => {
    const { service, repo } = setup();
    repo.state.mockResolvedValueOnce({
      status: "verified",
      attemptsUsed: 0,
      verifiedAvatarKey: "avatars/u1/a.jpg",
      verifiedDob: "1990-01-01",
      verifiedGender: "female",
    });
    await expect(service.status("u1", NOW)).resolves.toMatchObject({ status: "outdated" });
  });

  it("asks Didit about a pending session at most once a minute", async () => {
    const { service, repo, didit } = setup();
    const pending = { status: "pending", currentAttemptId: "attempt-1", attemptsUsed: 1 };
    repo.state.mockResolvedValue(pending);
    didit.decision.mockResolvedValue(decision("In Progress"));
    await service.status("u1", NOW);
    await service.status("u1", NOW + 30_000);
    expect(didit.decision).toHaveBeenCalledTimes(1);
    await service.status("u1", NOW + 61_000);
    expect(didit.decision).toHaveBeenCalledTimes(2);
  });
});

describe("BronzeService consent", () => {
  it("records only the current notice version", async () => {
    const { service, repo } = setup();
    await expect(service.consent("u1", true, "old")).rejects.toThrow(BadRequestException);
    await service.consent("u1", true, BRONZE_POLICY_VERSION);
    expect(repo.consent).toHaveBeenCalledWith("u1");
  });

  it("withdrawing erases every session at Didit, and survives one failing", async () => {
    const { service, repo, didit } = setup();
    didit.deleteSession.mockRejectedValueOnce(new Error("down"));
    await service.withdraw("u1");
    expect(repo.withdrawConsent).toHaveBeenCalledWith("u1");
    expect(didit.deleteSession.mock.calls.map((c) => c[0])).toEqual(["s1", "s2"]);
  });
});

describe("BronzeService.start", () => {
  it("won't verify a photo uploaded in the last ten minutes", async () => {
    const { service, repo, didit } = setup();
    repo.snapshot.mockResolvedValue(snapshot({ avatarUploadedAt: new Date(Date.now() - 60_000) }));
    await expect(service.start("u1")).rejects.toThrow(BadRequestException);
    expect(didit.createSession).not.toHaveBeenCalled();
  });

  it("needs consent, and sends rejected or revoked members to support", async () => {
    const { service, repo } = setup();
    repo.hasConsent.mockResolvedValueOnce(false);
    await expect(service.start("u1")).rejects.toThrow(/Consent/);
    repo.state.mockResolvedValue({ status: "rejected", attemptsUsed: 3 });
    await expect(service.start("u1")).rejects.toThrow(ForbiddenException);
  });

  it("remakes the photo's sizes from the original before opening the session", async () => {
    const { service, repo, didit, storage } = setup();
    repo.snapshot.mockResolvedValue(
      snapshot({ avatarUploadedAt: new Date(Date.now() - 3600_000) }),
    );
    await expect(service.start("u1")).resolves.toEqual({
      attemptId: "attempt-1",
      provider: "didit",
      url: "https://verify.didit.me/s1",
    });
    expect(storage.regenerateVariants).toHaveBeenCalledWith("avatars/u1/a.jpg");
    expect(storage.regenerateVariants.mock.invocationCallOrder[0]).toBeLessThan(
      didit.createSession.mock.invocationCallOrder[0],
    );
    expect(repo.reserve).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ dob: "1998-04-02", nationality: null }),
      "didit:s1",
    );
  });

  it("uses no attempt when the photo or Didit is unavailable", async () => {
    const { service, repo, didit, storage } = setup();
    repo.snapshot.mockResolvedValue(
      snapshot({ avatarUploadedAt: new Date(Date.now() - 3600_000) }),
    );
    storage.regenerateVariants.mockRejectedValueOnce(new Error("s3"));
    await expect(service.start("u1")).rejects.toThrow(ServiceUnavailableException);
    didit.createSession.mockRejectedValueOnce(new ServiceUnavailableException("down"));
    await expect(service.start("u1")).rejects.toThrow(ServiceUnavailableException);
    expect(repo.reserve).not.toHaveBeenCalled();
  });
});

describe("BronzeService decisions", () => {
  const due = [
    { id: "attempt-1", providerJobId: "didit:s1", createdAt: new Date(NOW - 20 * 60_000) },
  ];

  it("verifies when every check passes, keeping only a fingerprint of who it was", async () => {
    const { service, repo } = setup();
    repo.claimForReconcile.mockResolvedValueOnce(due);
    await service.reconcile(NOW);
    const recorded = repo.recordCallback.mock.calls[0][0] as Record<string, unknown>;
    expect(recorded).toMatchObject({ status: "verified", failureCodes: [] });
    expect(recorded.identityBinding).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(recorded)).not.toContain("Okafor");
  });

  it("sends an unconfirmed ID country to an admin, and tells the admins", async () => {
    const { service, repo, didit, push } = setup();
    didit.decision.mockResolvedValueOnce(
      decision("Approved", { issuing_state: "GHA", issuing_state_name: "Ghana" }),
    );
    repo.recordCallback.mockResolvedValueOnce({ status: "manual_review", reviewOpened: true });
    repo.claimForReconcile.mockResolvedValueOnce(due);
    await service.reconcile(NOW);
    expect(repo.recordCallback.mock.calls[0][0]).toMatchObject({
      status: "manual_review",
      failureCodes: ["ID_COUNTRY_UNCONFIRMED"],
    });
    expect(push.newVerificationReview).toHaveBeenCalledOnce();
  });

  it("sends one person's second account to an admin", async () => {
    const { service, repo } = setup();
    repo.bindingUsedElsewhere.mockResolvedValueOnce(true);
    repo.claimForReconcile.mockResolvedValueOnce(due);
    await service.reconcile(NOW);
    expect(repo.recordCallback.mock.calls[0][0]).toMatchObject({
      status: "manual_review",
      failureCodes: ["IDENTITY_ON_ANOTHER_ACCOUNT"],
    });
  });

  it("fails a declined session without paying for the photo comparison", async () => {
    const { service, repo, didit, profileMatch } = setup();
    didit.decision.mockResolvedValueOnce(decision("Declined"));
    repo.claimForReconcile.mockResolvedValueOnce(due);
    await service.reconcile(NOW);
    expect(profileMatch.evaluate).not.toHaveBeenCalled();
    expect(repo.recordCallback.mock.calls[0][0]).toMatchObject({
      status: "failed",
      failureCodes: ["DIDIT_DECLINED"],
    });
  });

  it("ignores a decision that isn't this member's session", async () => {
    const { service, repo, didit } = setup();
    didit.decision.mockResolvedValueOnce({ ...decision(), vendor_data: "someone-else" });
    repo.claimForReconcile.mockResolvedValueOnce(due);
    await service.reconcile(NOW);
    expect(repo.recordCallback).not.toHaveBeenCalled();
  });

  it("answers a webhook at once and settles it after", async () => {
    const { service, repo, didit } = setup();
    const body = Buffer.from(JSON.stringify({ session_id: "s1" }));
    expect(service.diditCallback(body, "v2", "v1", "123")).toEqual({ received: true });
    expect(didit.verifyWebhook).toHaveBeenCalledWith(body, "v2", "v1", "123");
    await vi.waitFor(() => expect(repo.recordCallback).toHaveBeenCalled());
  });
});

describe("BronzeService.reconcile", () => {
  it("expires a day-old session Didit never finished, but not one Didit is reviewing", async () => {
    const { service, repo, didit } = setup();
    const old = {
      id: "attempt-1",
      providerJobId: "didit:s1",
      createdAt: new Date(NOW - SESSION_EXPIRY_MS - 1),
    };
    didit.decision.mockResolvedValueOnce(decision("Not Started"));
    repo.claimForReconcile.mockResolvedValueOnce([old]);
    await service.reconcile(NOW);
    expect(repo.expireAttempt).toHaveBeenCalledWith("attempt-1");

    repo.expireAttempt.mockClear();
    didit.decision.mockResolvedValueOnce(decision("In Review"));
    repo.claimForReconcile.mockResolvedValueOnce([old]);
    await service.reconcile(NOW);
    expect(repo.expireAttempt).not.toHaveBeenCalled();
  });

  it("does nothing while verification is off", async () => {
    const { service, repo } = setup(false);
    await service.reconcile(NOW);
    expect(repo.claimForReconcile).not.toHaveBeenCalled();
  });
});

describe("BronzeService for admins", () => {
  const admin = { id: "admin-1", twoFactorEnabled: true };
  const input = {
    id: "review-1",
    decision: "approve" as const,
    evidenceReference: "didit s1",
    reason: "Photo and ID country checked.",
  };

  it("needs two-factor authentication", async () => {
    const { service } = setup();
    await expect(service.reviews({ id: "admin-1", twoFactorEnabled: false })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("shows the photo as members see it and the original, on short-lived links", async () => {
    const { service, repo, storage } = setup();
    repo.openReviews.mockResolvedValueOnce([
      {
        id: "r1",
        userId: "u1",
        username: "ada",
        displayName: "Ada",
        reasonCodes: ["ID_COUNTRY_UNCONFIRMED"],
        createdAt: new Date(NOW),
        providerJobId: "didit:s1",
        avatarKey: "avatars/u1/a.jpg",
        checks: {},
      },
    ] as never);
    const [row] = await service.reviews(admin);
    expect(row).toMatchObject({ providerSessionId: "s1", username: "ada" });
    expect(storage.presignReviewDownload).toHaveBeenCalledWith("avatars/u1/a.jpg", "md");
    expect(storage.presignReviewDownload).toHaveBeenCalledWith("avatars/u1/a.jpg");
  });

  it("explains why a decision didn't go through", async () => {
    const { service, repo } = setup();
    repo.decideReview.mockResolvedValueOnce({ ok: false, reason: "own" });
    await expect(service.decideReview(admin, input)).rejects.toThrow(ForbiddenException);
    repo.decideReview.mockResolvedValueOnce({ ok: false, reason: "checks" });
    await expect(service.decideReview(admin, input)).rejects.toThrow(/ID checks/);
    repo.decideReview.mockResolvedValueOnce({ ok: false, reason: "changed" });
    await expect(service.decideReview(admin, input)).rejects.toThrow(ConflictException);
    await expect(service.decideReview(admin, input)).resolves.toEqual({ status: "verified" });
    expect(repo.decideReview).toHaveBeenLastCalledWith({ ...input, reviewerId: "admin-1" });
  });

  it("revokes and reopens", async () => {
    const { service, repo } = setup();
    await expect(service.revoke(admin, "u9")).resolves.toEqual({ status: "revoked" });
    repo.reopen.mockResolvedValueOnce(false);
    await expect(service.reopen(admin, "u9")).rejects.toThrow(ConflictException);
  });
});
