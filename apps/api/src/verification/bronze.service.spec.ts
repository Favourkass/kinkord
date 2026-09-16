import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Signature } from "smile-identity-core";
import type { StorageService } from "../storage/storage.service";
import { BronzeService } from "./bronze.service";
import type { BronzeRepository } from "./bronze.repository";
import { SmileIdService } from "./smile-id.service";
import type { DiditService } from "./didit.service";

const snapshot = { avatarKey: "avatars/u1/current.jpg", avatarUploadedAt: new Date(),
  dob: "1998-04-02", gender: "Female", country: "NG" };

describe("BronzeService", () => {
  const status = vi.fn();
  const profile = vi.fn();
  const consent = vi.fn();
  const reserve = vi.fn();
  const findAttempt = vi.fn();
  const recordCallback = vi.fn();
  const webToken = vi.fn();
  const verifyCallback = vi.fn();
  const jobResults = vi.fn();
  const repo = { status, snapshot: profile, hasConsent: consent, reserve, findAttempt,
    recordCallback, consent: vi.fn() } as unknown as BronzeRepository;
  const smile = { configured: true, environment: "sandbox", partnerId: "0123",
    callbackUrl: "https://api.example.test/webhooks/smile-id",
    policyUrl: "https://example.test/privacy", webToken, verifyCallback, jobResults } as unknown as SmileIdService;
  const diditAdapter = { configured: false, policyUrl: "", createSession: vi.fn(), decision: vi.fn() };
  const didit = diditAdapter as unknown as DiditService;
  const service = new BronzeService(repo, smile, didit, { presignDownload: vi.fn() } as unknown as StorageService);

  beforeEach(() => {
    vi.clearAllMocks();
    diditAdapter.configured = false;
    status.mockResolvedValue(null);
    profile.mockResolvedValue(snapshot);
    consent.mockResolvedValue(true);
    reserve.mockResolvedValue("attempt-1");
    webToken.mockResolvedValue("short-lived-token");
    jobResults.mockResolvedValue([]);
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
