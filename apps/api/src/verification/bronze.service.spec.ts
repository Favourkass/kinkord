import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { PushService } from "../push/push.service";
import type { StorageService } from "../storage/storage.service";
import {
  ADMIN_STEP_UP_MS,
  BronzeService,
  PHOTO_SETTLE_MS,
  RESULT_FAILURES_TO_GIVE_UP,
  SESSION_EXPIRY_MS,
  STEP_UP_MAX_FAILURES,
} from "./bronze.service";
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
    hasAnyConsent: vi.fn(async () => true),
    consent: vi.fn(async () => undefined),
    withdrawConsent: vi.fn(async () => ["s1", "s2"]),
    queueErasuresForUser: vi.fn(async () => ["s1"]),
    reserve: vi.fn(async (): Promise<unknown> => ({
      attemptId: "attempt-1",
      reservationJobId: "reservation:attempt-1",
    })),
    attachProviderSession: vi.fn(async () => true),
    cancelReservation: vi.fn(async () => true),
    queueErasure: vi.fn(async () => undefined),
    claimErasures: vi.fn(async (): Promise<unknown[]> => []),
    completeErasure: vi.fn(async () => undefined),
    failErasure: vi.fn(async () => undefined),
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
    recordAdminStepUp: vi.fn(async () => undefined),
    hasActiveAdminStepUp: vi.fn(async () => true),
    latestAttempt: vi.fn(async (): Promise<unknown> => null),
    noteProviderStatus: vi.fn(async () => undefined),
    noteResultFailure: vi.fn(async (): Promise<unknown> => ({
      resultFailures: 1,
      providerStatus: null,
    })),
    staleReservations: vi.fn(async (): Promise<unknown[]> => []),
    holdIdentities: vi.fn(async () => undefined),
    stepUpLockedUntil: vi.fn(async (): Promise<Date | null> => null),
    recordStepUpFailure: vi.fn(async (): Promise<Date | null> => null),
    clearStepUpFailures: vi.fn(async () => undefined),
    adminIds: vi.fn(async (): Promise<string[]> => []),
    otherHolderOf: vi.fn(async (): Promise<unknown> => null),
    reviewSubject: vi.fn(async (): Promise<string | null> => "u1"),
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
  const push = {
    newVerificationReview: vi.fn(),
    verificationUpdate: vi.fn(),
    verificationUnderage: vi.fn(),
  };
  const config = VerificationConfig.fixed(
    parseVerificationSettings(
      configured
        ? {
            enabled: true,
            policyUrl: "https://kinkord.test/privacy/verification",
            returnUrl: "https://kinkord.test/settings/verification",
            diditApiKey: "test-key",
            diditWebhookSecret: "test-webhook-secret",
            diditWorkflowId: "workflow-1",
            bindingSecret: "b".repeat(40),
          }
        : { bindingSecret: "b".repeat(40) },
    ),
  );
  const auth = {
    api: { verifyTOTP: vi.fn(async () => ({ token: "session-token", user: { id: "admin-1" } })) },
  };
  const service = new BronzeService(
    repo as unknown as BronzeRepository,
    didit as unknown as DiditService,
    storage as unknown as StorageService,
    profileMatch as unknown as ProfileMatchService,
    push as unknown as PushService,
    config,
    auth as never,
  );
  return { service, repo, didit, storage, profileMatch, push, auth, config };
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
    expect(status.withdrawable).toBe(true);
  });

  it("keeps withdrawal available when only an older notice version was accepted", async () => {
    const { service, repo } = setup();
    repo.hasConsent.mockResolvedValueOnce(false);
    repo.hasAnyConsent.mockResolvedValueOnce(true);
    await expect(service.status("u1", NOW)).resolves.toMatchObject({
      consented: false,
      withdrawable: true,
    });
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

describe("BronzeService for members coming back", () => {
  it("offers to continue a Didit session the member closed midway", async () => {
    const { service, repo } = setup();
    repo.state.mockResolvedValue({
      status: "pending",
      attemptsUsed: 1,
      currentAttemptId: "attempt-1",
    });
    repo.latestAttempt.mockResolvedValue(attempt({ providerStatus: "In Progress" }));
    const status = await service.status("u1", NOW);
    expect(status.resumable).toBe(true);
    repo.latestAttempt.mockResolvedValue(attempt({ providerStatus: "In Review" }));
    expect((await service.status("u1", NOW + 120_000)).resumable).toBe(false);
  });

  it("hands back the same session's link, and only while it can be continued", async () => {
    const { service, repo, didit } = setup();
    repo.state.mockResolvedValue({
      status: "pending",
      attemptsUsed: 1,
      currentAttemptId: "attempt-1",
    });
    didit.decision.mockResolvedValueOnce({
      ...decision("In Progress"),
      session_url: "https://verify.didit.me/session/abc",
    });
    await expect(service.resume("u1")).resolves.toEqual({
      url: "https://verify.didit.me/session/abc",
    });
    didit.decision.mockResolvedValueOnce({
      ...decision("In Review"),
      session_url: "https://verify.didit.me/session/abc",
    });
    await expect(service.resume("u1")).rejects.toThrow(ConflictException);
    didit.decision.mockResolvedValueOnce({
      ...decision("In Progress"),
      session_url: "https://evil.example/session/abc",
    });
    await expect(service.resume("u1")).rejects.toThrow(ConflictException);
  });

  it("says why the last attempt didn't pass, in terms the member can act on", async () => {
    const { service, repo } = setup();
    repo.state.mockResolvedValue({ status: "failed", attemptsUsed: 1, currentAttemptId: null });
    repo.latestAttempt.mockResolvedValue(
      attempt({
        status: "failed",
        failureCodes: ["DIDIT_REQUIRED_CHECK_MISSING"],
        checks: { governmentId: true, liveness: true, idFace: true, dateOfBirth: false },
      }),
    );
    expect((await service.status("u1", NOW)).lastFailure).toBe("birth_date");
  });

  it("offers verification only to listed testers while testing", async () => {
    const { service, config } = setup();
    Object.assign(config.current, { testers: ["staff-1"] });
    expect((await service.status("u1", NOW)).available).toBe(false);
    expect((await service.status("staff-1", NOW)).available).toBe(true);
  });

  it("holds a banned member's identity before their account is deleted", async () => {
    const { service, repo } = setup();
    await service.forgetMember("u1", { hold: true });
    expect(repo.holdIdentities).toHaveBeenCalledWith("u1");
    expect(repo.queueErasuresForUser).toHaveBeenCalledWith("u1");
    repo.holdIdentities.mockClear();
    await service.forgetMember("u2");
    expect(repo.holdIdentities).not.toHaveBeenCalled();
  });
});

describe("BronzeService consent", () => {
  it("records only the current notice version", async () => {
    const { service, repo } = setup();
    await expect(service.consent("u1", true, "old")).rejects.toThrow(BadRequestException);
    await service.consent("u1", true, BRONZE_POLICY_VERSION);
    expect(repo.consent).toHaveBeenCalledWith("u1");
  });

  it("withdrawal processes durable erasures and retains a failed one for retry", async () => {
    const { service, repo, didit } = setup();
    repo.claimErasures.mockResolvedValueOnce([
      { id: "e1", providerSessionId: "s1" },
      { id: "e2", providerSessionId: "s2" },
    ]);
    didit.deleteSession.mockRejectedValueOnce(new Error("down"));
    await service.withdraw("u1");
    expect(repo.withdrawConsent).toHaveBeenCalledWith("u1");
    expect(didit.deleteSession.mock.calls.map((c) => c[0])).toEqual(["s1", "s2"]);
    expect(repo.failErasure).toHaveBeenCalledWith("e1", "Error");
    expect(repo.completeErasure).toHaveBeenCalledWith("e2");
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
    );
    expect(repo.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      didit.createSession.mock.invocationCallOrder[0],
    );
    expect(repo.attachProviderSession).toHaveBeenCalledWith("attempt-1", "s1");
  });

  it("releases its local reservation when the photo or Didit is unavailable", async () => {
    const { service, repo, didit, storage } = setup();
    repo.snapshot.mockResolvedValue(
      snapshot({ avatarUploadedAt: new Date(Date.now() - 3600_000) }),
    );
    storage.regenerateVariants.mockRejectedValueOnce(new Error("s3"));
    await expect(service.start("u1")).rejects.toThrow(ServiceUnavailableException);
    expect(repo.cancelReservation).toHaveBeenCalledTimes(1);
    expect(didit.createSession).not.toHaveBeenCalled();
    didit.createSession.mockRejectedValueOnce(new ServiceUnavailableException("down"));
    await expect(service.start("u1")).rejects.toThrow(ServiceUnavailableException);
    expect(repo.reserve).toHaveBeenCalledTimes(2);
    expect(repo.cancelReservation).toHaveBeenCalledTimes(2);
    expect(repo.cancelReservation).toHaveBeenCalledWith("attempt-1");
  });

  it("reserves before any photo work, so a burst of taps does the work once", async () => {
    const { service, repo, storage } = setup();
    repo.reserve.mockResolvedValueOnce(null);
    await expect(service.start("u1")).rejects.toThrow(ConflictException);
    expect(storage.regenerateVariants).not.toHaveBeenCalled();
  });

  it("queues a paid session for deletion even if attaching it throws", async () => {
    const { service, repo } = setup();
    repo.attachProviderSession.mockRejectedValueOnce(new Error("db down"));
    await expect(service.start("u1")).rejects.toThrow(ConflictException);
    expect(repo.queueErasure).toHaveBeenCalledWith("s1");
  });

  it("queues a paid session for deletion if attaching it loses the reservation", async () => {
    const { service, repo } = setup();
    repo.attachProviderSession.mockResolvedValueOnce(false);
    await expect(service.start("u1")).rejects.toThrow(ConflictException);
    expect(repo.queueErasure).toHaveBeenCalledWith("s1");
    expect(repo.cancelReservation).toHaveBeenCalledWith("attempt-1");
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

  it("leaves second accounts to the recorded result, decided under the identity's lock", async () => {
    const { service, repo } = setup();
    repo.claimForReconcile.mockResolvedValueOnce(due);
    await service.reconcile(NOW);
    expect(repo.bindingUsedElsewhere).not.toHaveBeenCalled();
    expect(repo.recordCallback.mock.calls[0][0]).toMatchObject({
      status: "verified",
      identityBinding: expect.any(String),
    });
  });

  it("sends Didit's possible duplicate to an admin, and tells the member and admins", async () => {
    const { service, repo, didit, push } = setup();
    didit.decision.mockResolvedValueOnce({
      ...decision(),
      id_verifications: [
        {
          ...decision().id_verifications[0],
          warnings: [{ risk: "POSSIBLE_DUPLICATED_USER" }],
        },
      ],
    });
    repo.recordCallback.mockResolvedValueOnce({ status: "manual_review", reviewOpened: true });
    repo.claimForReconcile.mockResolvedValueOnce(due);
    await service.reconcile(NOW);
    expect(repo.recordCallback.mock.calls[0][0]).toMatchObject({
      status: "manual_review",
      failureCodes: ["POSSIBLE_DUPLICATE_AT_DIDIT"],
    });
    expect(push.newVerificationReview).toHaveBeenCalled();
    expect(push.verificationUpdate).toHaveBeenCalledWith("u1");
  });

  it("sends a face Didit's search found on another member to an admin", async () => {
    const { service, repo, didit } = setup();
    didit.decision.mockResolvedValueOnce({
      ...decision(),
      liveness_checks: [{ status: "Approved", warnings: [{ risk: "DUPLICATED_FACE" }] }],
    });
    repo.claimForReconcile.mockResolvedValueOnce(due);
    await service.reconcile(NOW);
    expect(repo.recordCallback.mock.calls[0][0]).toMatchObject({
      status: "manual_review",
      failureCodes: ["FACE_ON_ANOTHER_ACCOUNT"],
    });
  });

  it("alerts the admins when the ID says the member may be under 18", async () => {
    const { service, repo, didit, push } = setup();
    didit.decision.mockResolvedValueOnce({
      ...decision("Declined"),
      id_verifications: [
        {
          status: "Declined",
          date_of_birth: "2012-01-01",
          warnings: [{ risk: "MINIMUM_AGE_NOT_MET" }],
        },
      ],
    });
    repo.recordCallback.mockResolvedValueOnce({ status: "failed", reviewOpened: false });
    repo.claimForReconcile.mockResolvedValueOnce(due);
    await service.reconcile(NOW);
    expect(push.verificationUnderage).toHaveBeenCalledWith("u1");
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
    expect(repo.expireAttempt).toHaveBeenCalledWith("attempt-1", "SESSION_EXPIRED");

    repo.expireAttempt.mockClear();
    didit.decision.mockResolvedValueOnce(decision("In Review"));
    repo.claimForReconcile.mockResolvedValueOnce([old]);
    await service.reconcile(NOW);
    expect(repo.expireAttempt).not.toHaveBeenCalled();
  });

  it("never ends an old attempt on one failed read, and gives it back after an hour of them", async () => {
    const { service, repo, didit } = setup();
    const old = {
      id: "attempt-1",
      providerJobId: "didit:s1",
      createdAt: new Date(NOW - SESSION_EXPIRY_MS - 1),
    };
    repo.claimForReconcile.mockResolvedValueOnce([old]);
    didit.decision.mockRejectedValueOnce(new ServiceUnavailableException("down"));
    await service.reconcile(NOW);
    expect(repo.noteResultFailure).toHaveBeenCalledWith("attempt-1");
    expect(repo.expireAttempt).not.toHaveBeenCalled();

    repo.claimForReconcile.mockResolvedValueOnce([old]);
    didit.decision.mockRejectedValueOnce(new ServiceUnavailableException("down"));
    repo.noteResultFailure.mockResolvedValueOnce({
      resultFailures: RESULT_FAILURES_TO_GIVE_UP,
      providerStatus: "In Progress",
    });
    await service.reconcile(NOW);
    expect(repo.expireAttempt).toHaveBeenCalledWith("attempt-1", "RESULT_UNAVAILABLE");
  });

  it("never gives up on a session Didit's reviewers have, however long reads fail", async () => {
    const { service, repo, didit } = setup();
    const old = {
      id: "attempt-1",
      providerJobId: "didit:s1",
      createdAt: new Date(NOW - SESSION_EXPIRY_MS - 1),
    };
    repo.claimForReconcile.mockResolvedValueOnce([old]);
    didit.decision.mockRejectedValueOnce(new ServiceUnavailableException("down"));
    repo.noteResultFailure.mockResolvedValueOnce({
      resultFailures: RESULT_FAILURES_TO_GIVE_UP + 5,
      providerStatus: "In Review",
    });
    await service.reconcile(NOW);
    expect(repo.expireAttempt).not.toHaveBeenCalled();
  });

  it("doesn't expire an attempt whose photo comparison is still running", async () => {
    const { service, repo, profileMatch } = setup();
    profileMatch.evaluate.mockResolvedValueOnce(null);
    repo.claimForReconcile.mockResolvedValueOnce([
      {
        id: "attempt-1",
        providerJobId: "didit:s1",
        createdAt: new Date(NOW - SESSION_EXPIRY_MS - 1),
      },
    ]);
    await service.reconcile(NOW);
    expect(repo.expireAttempt).not.toHaveBeenCalled();
  });

  it("releases starts that never got a Didit session", async () => {
    const { service, repo } = setup(false);
    repo.staleReservations.mockResolvedValueOnce([{ id: "attempt-9" }]);
    await service.reconcile(NOW);
    expect(repo.cancelReservation).toHaveBeenCalledWith("attempt-9");
  });

  it("does nothing while verification is off", async () => {
    const { service, repo } = setup(false);
    await service.reconcile(NOW);
    expect(repo.claimForReconcile).not.toHaveBeenCalled();
  });
});

describe("BronzeService for admins", () => {
  const admin = { id: "admin-1", twoFactorEnabled: true, sessionId: "session-1" };
  const input = {
    id: "review-1",
    decision: "approve" as const,
    evidenceReference: "didit s1",
    reason: "Photo and ID country checked.",
  };

  it("needs two-factor authentication", async () => {
    const { service, repo } = setup();
    await expect(
      service.reviews({ id: "admin-1", twoFactorEnabled: false, sessionId: "session-1" }),
    ).rejects.toThrow(ForbiddenException);
    repo.hasActiveAdminStepUp.mockResolvedValueOnce(false);
    await expect(service.reviews(admin)).rejects.toThrow(/current two-factor code/);
  });

  it("records a successful TOTP proof for this session only", async () => {
    const { service, repo, auth } = setup();
    const headers = new Headers({ cookie: "session=x" });
    await expect(service.stepUp(admin, "123456", headers, NOW)).resolves.toEqual({
      verifiedUntil: new Date(NOW + ADMIN_STEP_UP_MS).toISOString(),
    });
    expect(auth.api.verifyTOTP).toHaveBeenCalledWith({
      body: { code: "123456", trustDevice: false },
      headers,
    });
    expect(repo.recordAdminStepUp).toHaveBeenCalledWith(
      "session-1",
      "admin-1",
      new Date(NOW + ADMIN_STEP_UP_MS),
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
    await expect(service.revoke(admin, "u9", "Confirmed document fraud.")).resolves.toEqual({
      status: "revoked",
    });
    expect(repo.revoke).toHaveBeenCalledWith("u9", "admin-1", "Confirmed document fraud.");
    repo.reopen.mockResolvedValueOnce(false);
    await expect(service.reopen(admin, "u9", "Support approved a retry.")).rejects.toThrow(
      ConflictException,
    );
  });

  it("does not let an admin revoke or reopen their own verification", async () => {
    const { service, repo } = setup();
    await expect(service.revoke(admin, "admin-1", "Trying this on myself.")).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.reopen(admin, "admin-1", "Trying this on myself.")).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.revoke).not.toHaveBeenCalled();
    expect(repo.reopen).not.toHaveBeenCalled();
  });

  it("counts wrong codes and locks the admin out after too many", async () => {
    const { service, repo, auth } = setup();
    const headers = new Headers();
    auth.api.verifyTOTP.mockRejectedValueOnce(new Error("INVALID_CODE"));
    await expect(service.stepUp(admin, "000000", headers, NOW)).rejects.toMatchObject({
      response: { code: "INVALID_CODE" },
    });
    expect(repo.recordStepUpFailure).toHaveBeenCalledWith("admin-1", STEP_UP_MAX_FAILURES, 15);
    expect(repo.recordAdminStepUp).not.toHaveBeenCalled();

    const until = new Date(NOW + 15 * 60_000);
    auth.api.verifyTOTP.mockRejectedValueOnce(new Error("INVALID_CODE"));
    repo.recordStepUpFailure.mockResolvedValueOnce(until);
    await expect(service.stepUp(admin, "000001", headers, NOW)).rejects.toMatchObject({
      status: 429,
      response: { code: "STEP_UP_LOCKED", retryAt: until.toISOString() },
    });

    // Locked: not even a right code is tried until it ends.
    auth.api.verifyTOTP.mockClear();
    repo.stepUpLockedUntil.mockResolvedValueOnce(until);
    await expect(service.stepUp(admin, "123456", headers, NOW)).rejects.toMatchObject({
      status: 429,
    });
    expect(auth.api.verifyTOTP).not.toHaveBeenCalled();
  });

  it("clears the count on a right code, and says which code the web should act on", async () => {
    const { service, repo } = setup();
    await service.stepUp(admin, "123456", new Headers(), NOW);
    expect(repo.clearStepUpFailures).toHaveBeenCalledWith("admin-1");
    repo.hasActiveAdminStepUp.mockResolvedValueOnce(false);
    await expect(service.reviews(admin)).rejects.toMatchObject({
      response: { code: "STEP_UP_REQUIRED" },
    });
    await expect(
      service.stepUp({ ...admin, twoFactorEnabled: false }, "123456", new Headers(), NOW),
    ).rejects.toMatchObject({ response: { code: "TWO_FACTOR_OFF" } });
  });

  it("marks reviews an admin can't decide: their own, and other admins' unless a founder", async () => {
    const { service, repo } = setup();
    const row = {
      username: "x",
      displayName: "X",
      reasonCodes: ["IDENTITY_ON_ANOTHER_ACCOUNT"],
      createdAt: new Date(NOW),
      providerJobId: "didit:s1",
      avatarKey: "avatars/u/a.jpg",
      checks: {},
      identityBinding: "fp-1",
    };
    repo.openReviews.mockResolvedValue([
      { ...row, id: "r1", userId: "admin-1" },
      { ...row, id: "r2", userId: "admin-2" },
      { ...row, id: "r3", userId: "u3" },
    ] as never);
    repo.adminIds.mockResolvedValue(["admin-1", "admin-2"]);
    repo.otherHolderOf.mockResolvedValue({ userId: "u7", username: "seven" });
    const rows = await service.reviews(admin);
    expect(rows.map((r) => [r.own, r.protected])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect(rows[2].duplicateOf).toEqual({ userId: "u7", username: "seven" });
    const asFounder = await service.reviews({ ...admin, founder: true });
    expect(asFounder[1].protected).toBe(false);
  });

  it("only lets a founder decide, revoke or reopen another admin's verification", async () => {
    const { service, repo } = setup();
    repo.adminIds.mockResolvedValue(["admin-1", "admin-2"]);
    await expect(service.revoke(admin, "admin-2", "Checking admin rules.")).rejects.toThrow(
      /Only a founder/,
    );
    repo.reviewSubject.mockResolvedValueOnce("admin-2");
    await expect(service.decideReview(admin, input)).rejects.toThrow(/Only a founder/);
    expect(repo.revoke).not.toHaveBeenCalled();
    expect(repo.decideReview).not.toHaveBeenCalled();
    await expect(
      service.revoke({ ...admin, founder: true }, "admin-2", "Checking admin rules."),
    ).resolves.toEqual({ status: "revoked" });
  });

  it("tells the member when their verification is decided, revoked or reopened", async () => {
    const { service, repo, push } = setup();
    repo.decideReview.mockResolvedValueOnce({ ok: true, status: "verified", userId: "u1" });
    await service.decideReview(admin, input);
    await service.revoke(admin, "u9", "Confirmed document fraud.");
    await service.reopen(admin, "u9", "Support approved a retry.");
    expect(push.verificationUpdate.mock.calls).toEqual([["u1"], ["u9"], ["u9"]]);
    repo.decideReview.mockResolvedValueOnce({ ok: false, reason: "duplicate" });
    await expect(service.decideReview(admin, input)).rejects.toThrow(/can only be rejected/);
  });

  it("says on a member's page whether this admin may act on them", async () => {
    const { service, repo } = setup();
    repo.adminIds.mockResolvedValue(["admin-1", "admin-2"]);
    await expect(service.adminStatus(admin, "admin-2")).resolves.toMatchObject({
      own: false,
      protected: true,
    });
    await expect(service.adminStatus(admin, "admin-1")).resolves.toMatchObject({ own: true });
  });
});
