import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Signature } from "smile-identity-core";
import type { StorageService } from "../storage/storage.service";
import { BronzeService } from "./bronze.service";
import { BRONZE_POLICY_VERSION } from "./bronze-policy";
import type { BronzeRepository } from "./bronze.repository";
import { SmileIdService } from "./smile-id.service";
import type { DiditService } from "./didit.service";
import type { ProfileMatchService } from "./profile-match.service";
import type { KycIngestionService } from "./kyc-ingestion.service";

const snapshot = { avatarKey: "avatars/u1/current.jpg", avatarUploadedAt: new Date(),
  dob: "1998-04-02", gender: "Female", country: "NG" };

describe("BronzeService", () => {
  const status = vi.fn();
  const profile = vi.fn();
  const consent = vi.fn();
  const reserve = vi.fn();
  const findAttempt = vi.fn();
  const recordCallback = vi.fn();
  const saveConsent = vi.fn();
  const openReviews = vi.fn();
  const decideReview = vi.fn();
  const presignDownload = vi.fn();
  const webToken = vi.fn();
  const verifyCallback = vi.fn();
  const jobResults = vi.fn();
  const repo = { status, snapshot: profile, hasConsent: consent, reserve, findAttempt,
    recordCallback, consent: saveConsent, openReviews, decideReview } as unknown as BronzeRepository;
  const smile = { configured: true, environment: "sandbox", partnerId: "0123",
    callbackUrl: "https://api.example.test/webhooks/smile-id",
    policyUrl: "https://example.test/privacy", webToken, verifyCallback, jobResults } as unknown as SmileIdService;
  const diditAdapter = { configured: false, policyUrl: "", workflowId: "bronze-workflow", createSession: vi.fn(),
    decision: vi.fn(), verifyWebhook: vi.fn() };
  const didit = diditAdapter as unknown as DiditService;
  const evaluate = vi.fn();
  const recordDiditDecision = vi.fn();
  const service = new BronzeService(repo, smile, didit, { presignDownload } as unknown as StorageService,
    { evaluate } as unknown as ProfileMatchService, { recordDiditDecision } as unknown as KycIngestionService);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    diditAdapter.configured = false;
    status.mockResolvedValue(null);
    profile.mockResolvedValue(snapshot);
    consent.mockResolvedValue(true);
    reserve.mockResolvedValue("attempt-1");
    webToken.mockResolvedValue("short-lived-token");
    jobResults.mockResolvedValue([]);
    openReviews.mockResolvedValue([]);
    presignDownload.mockResolvedValue("https://media.example.test/profile.jpg");
    evaluate.mockResolvedValue({ outcome: "review", reason: "PROFILE_PHOTO_FACE_MATCH_REQUIRED" });
    recordDiditDecision.mockResolvedValue(undefined);
  });

  it("requires both the reviewer allowlist and 2FA before exposing the queue", async () => {
    vi.stubEnv("BRONZE_REVIEWER_EMAILS", "reviewer@kinkord.com");
    await expect(service.reviews({ id: "staff-1", email: "reviewer@kinkord.com", twoFactorEnabled: false }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reviews({ id: "staff-2", email: "other@kinkord.com", twoFactorEnabled: true }))
      .rejects.toBeInstanceOf(ForbiddenException);
    openReviews.mockResolvedValue([{ id: "review-1", userId: "u1", attemptId: "attempt-1",
      reasonCodes: ["PROFILE_PHOTO_FACE_MATCH_REQUIRED"], createdAt: new Date(),
      providerJobId: "didit:session-1", avatarKey: snapshot.avatarKey, checks: {} }]);
    await expect(service.reviews({ id: "staff-1", email: "REVIEWER@KINKORD.COM", twoFactorEnabled: true }))
      .resolves.toEqual([expect.objectContaining({ id: "review-1", profilePhotoUrl: "https://media.example.test/profile.jpg" })]);
  });

  it("does not record consent while no approved provider notice is configured", async () => {
    Object.defineProperty(smile, "configured", { value: false, configurable: true });
    try {
      await expect(service.consent("u1", true, BRONZE_POLICY_VERSION))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(saveConsent).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(smile, "configured", { value: true, configurable: true });
    }
  });

  it("requires a current avatar and identity fields before requesting a token", async () => {
    profile.mockResolvedValue({ ...snapshot, avatarKey: null });
    await expect(service.start("u1")).rejects.toBeInstanceOf(BadRequestException);
    expect(webToken).not.toHaveBeenCalled();
  });

  it("does not reserve an attempt when Smile cannot issue a token", async () => {
    webToken.mockRejectedValue(new Error("provider down"));
    await expect(service.start("u1")).rejects.toThrow("provider down");
    expect(reserve).not.toHaveBeenCalled();
  });

  it("uses Didit first when both providers are configured", async () => {
    diditAdapter.configured = true;
    diditAdapter.createSession.mockResolvedValue({ sessionId: "didit-session-1", url: "https://verify.didit.me/session/test" });
    const launch = await service.start("u1");
    expect(launch).toEqual({ attemptId: "attempt-1", provider: "didit", url: "https://verify.didit.me/session/test" });
    expect(reserve).toHaveBeenCalledWith("u1", expect.any(Object), "didit:didit-session-1");
    expect(webToken).not.toHaveBeenCalled();
  });

  it("uses Smile only when Didit cannot create a session", async () => {
    diditAdapter.configured = true;
    diditAdapter.createSession.mockRejectedValue(new ServiceUnavailableException("provider down"));
    const launch = await service.start("u1");
    expect(launch.provider).toBe("smile");
    expect(webToken).toHaveBeenCalledOnce();
  });

  const passingDidit = () => {
    findAttempt.mockResolvedValue({
      id: "attempt-1", userId: "u1", status: "started", avatarKey: snapshot.avatarKey, profileDob: snapshot.dob,
      profileGender: snapshot.gender, profileCountry: snapshot.country,
    });
    diditAdapter.decision.mockResolvedValue({
      session_id: "session-1", session_kind: "user", vendor_data: "u1",
      workflow_id: "bronze-workflow", status: "Approved",
      id_verifications: [{ status: "Approved", date_of_birth: snapshot.dob,
        gender: "F", issuing_state: "NGA" }],
      liveness_checks: [{ status: "Approved", method: "ACTIVE_3D" }],
      face_matches: [{ status: "Approved" }],
      database_validations: [{ status: "Approved", validations: [
        { service_id: "nga_national_id", outcome_code: "MATCH" },
      ] }],
    });
  };

  it("sends a passing Didit result to review if profile matching cannot approve", async () => {
    passingDidit();
    service.diditCallback(Buffer.from('{"session_id":"session-1"}'), "signature", undefined, "timestamp");
    await vi.waitFor(() => expect(recordCallback).toHaveBeenCalledWith(expect.objectContaining({
      status: "manual_review", failureCodes: ["PROFILE_PHOTO_FACE_MATCH_REQUIRED"],
      checks: expect.objectContaining({ governmentId: true, liveness: true,
        idFace: true, dateOfBirth: true, gender: true, country: true, profileFace: false }),
    })));
  });

  it("awards Bronze only after the separate profile comparison also passes", async () => {
    passingDidit();
    evaluate.mockResolvedValue({ outcome: "matched", reason: null });
    service.diditCallback(Buffer.from('{"session_id":"session-1"}'), "signature", undefined, "timestamp");
    await vi.waitFor(() => expect(recordCallback).toHaveBeenCalledWith(expect.objectContaining({
      status: "verified", failureCodes: [], checks: expect.objectContaining({ profileFace: true }),
    })));
  });

  it.each(["Declined", "In Review", "Not Started"])("does not run photo matching for %s", async (providerStatus) => {
    passingDidit();
    const decision = await diditAdapter.decision();
    diditAdapter.decision.mockResolvedValue({ ...decision, status: providerStatus });
    await service["recordDiditDecision"]("session-1");
    expect(evaluate).not.toHaveBeenCalled();
    if (providerStatus === "Declined") expect(recordCallback).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    else expect(recordCallback).not.toHaveBeenCalled();
  });

  it("does not compare photos with missing Nigerian registry evidence", async () => {
    passingDidit();
    const decision = await diditAdapter.decision();
    diditAdapter.decision.mockResolvedValue({ ...decision, database_validations: [] });
    await service["recordDiditDecision"]("session-1");
    expect(evaluate).not.toHaveBeenCalled();
    expect(recordCallback).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("rejects a mismatched authenticated decision before processing images", async () => {
    passingDidit();
    const decision = await diditAdapter.decision();
    diditAdapter.decision.mockResolvedValue({ ...decision, vendor_data: "another-user" });
    await expect(service["recordDiditDecision"]("session-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("ignores completed attempts and waits for an in-flight comparison", async () => {
    findAttempt.mockResolvedValue({ status: "verified" });
    await service["recordDiditDecision"]("session-1");
    expect(diditAdapter.decision).not.toHaveBeenCalled();
    passingDidit();
    evaluate.mockResolvedValue(null);
    await service["recordDiditDecision"]("session-1");
    expect(recordCallback).not.toHaveBeenCalled();
  });

  it("does not allow a fourth or concurrent attempt", async () => {
    status.mockResolvedValue({ status: "manual_review", attemptsUsed: 3 });
    await expect(service.start("u1")).rejects.toBeInstanceOf(ConflictException);
    expect(webToken).not.toHaveBeenCalled();
  });

  it("never approves Bronze from the two positive Smile callbacks without the DP check", async () => {
    findAttempt.mockResolvedValue({
      id: "attempt-1", userId: "u1", number: 1, profileDob: snapshot.dob,
      profileGender: snapshot.gender, profileCountry: snapshot.country, checks: {},
    });
    const providerResult = {
      signature: "signed", timestamp: new Date().toISOString(),
      PartnerParams: { job_id: "job-1", user_id: "u1" }, ResultCode: "1012",
      Actions: { Verify_ID_Number: "Verified" }, DOB: snapshot.dob, Gender: "F", Country: "NG",
    };
    jobResults.mockResolvedValue([providerResult]);
    await service.smileCallback(providerResult);
    expect(recordCallback).toHaveBeenCalledWith(expect.objectContaining({ status: "processing",
      checks: expect.objectContaining({ governmentId: true, profileFace: false }) }));
  });

  it("fails closed when the signed provider status cannot confirm a callback result", async () => {
    findAttempt.mockResolvedValue({ id: "attempt-1", userId: "u1", checks: {} });
    await expect(service.smileCallback({ signature: "signed", timestamp: new Date().toISOString(),
      PartnerParams: { job_id: "job-1", user_id: "u1" }, ResultCode: "0810" }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(recordCallback).not.toHaveBeenCalled();
  });
});

describe("Smile callback authentication", () => {
  it("rejects an unsigned callback and accepts a valid provider signature", () => {
    vi.stubEnv("SMILE_ID_PARTNER_ID", "0123");
    vi.stubEnv("SMILE_ID_API_KEY", "sandbox-test-key");
    vi.stubEnv("SMILE_ID_CALLBACK_URL", "https://api.example.test/webhooks/smile-id");
    vi.stubEnv("SMILE_ID_POLICY_URL", "https://example.test/privacy");
    const service = new SmileIdService();
    const timestamp = new Date().toISOString();
    expect(() => service.verifyCallback({ timestamp, signature: "bad" })).toThrow(UnauthorizedException);
    const signature = new Signature("0123", "sandbox-test-key").generate_signature(timestamp).signature;
    expect(() => service.verifyCallback({ timestamp, signature })).not.toThrow();
    vi.unstubAllEnvs();
  });
});
