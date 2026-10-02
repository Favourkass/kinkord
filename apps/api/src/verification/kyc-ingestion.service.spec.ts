import { describe, expect, it, vi } from "vitest";
import type { KycRepository } from "./kyc.repository";
import { KycIngestionService } from "./kyc-ingestion.service";
import { KYC_RESIDENCE_POLICY_VERSION } from "./kyc-policy";

describe("KycIngestionService", () => {
  it("stores derived Didit stage outcomes without sensitive provider data", async () => {
    const upsertDerivedStageResult = vi.fn().mockResolvedValue(undefined);
    const ensureProviderAttempt = vi.fn().mockResolvedValue(undefined);
    const hasActiveConsent = vi.fn().mockResolvedValue(true);
    const service = new KycIngestionService({
      ensureProviderAttempt,
      upsertDerivedStageResult,
      hasActiveConsent,
    } as unknown as KycRepository);
    await service.recordDiditDecision({
      userId: "member-1",
      attemptId: "00000000-0000-4000-8000-000000000001",
      providerReference: "session-1",
      profileCountry: "NG",
      providerDeclined: false,
      identityChecks: {
        governmentId: true,
        liveness: true,
        idFace: true,
        profileFace: true,
        dateOfBirth: true,
        gender: true,
        country: true,
      },
      decision: {
        poa: {
          status: "Approved",
          poa_address: "private address",
          issue_date: "2026-09-01",
          warnings: [],
        },
        ip_analyses: [
          {
            status: "Approved",
            ip_country_code: "NG",
            latitude: 6.5,
            longitude: 3.3,
            is_vpn_or_tor: false,
            is_data_center: false,
            warnings: [],
          },
        ],
      },
    });
    expect(upsertDerivedStageResult).toHaveBeenCalledTimes(3);
    expect(ensureProviderAttempt).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000001",
      userId: "member-1",
      provider: "didit",
      providerReference: "session-1",
    });
    const persisted = JSON.stringify(upsertDerivedStageResult.mock.calls);
    expect(persisted).not.toContain("private address");
    expect(persisted).not.toContain("6.5");
    expect(persisted).not.toContain("3.3");
    expect(upsertDerivedStageResult).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "identity", status: "passed" }),
    );
    expect(upsertDerivedStageResult).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "residence", status: "passed" }),
    );
    expect(upsertDerivedStageResult).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "location", status: "under_review" }),
    );
    expect(hasActiveConsent).toHaveBeenCalledWith(
      "member-1",
      "residence",
      KYC_RESIDENCE_POLICY_VERSION,
    );
  });

  it("stores no residence evidence when proof-of-address consent is missing", async () => {
    const upsertDerivedStageResult = vi.fn().mockResolvedValue(undefined);
    const service = new KycIngestionService({
      ensureProviderAttempt: vi.fn().mockResolvedValue(undefined),
      upsertDerivedStageResult,
      hasActiveConsent: vi.fn().mockResolvedValue(false),
    } as unknown as KycRepository);
    await service.recordDiditDecision({
      userId: "member-1",
      attemptId: "00000000-0000-4000-8000-000000000009",
      providerReference: "session-9",
      profileCountry: "NG",
      providerDeclined: false,
      identityChecks: {
        governmentId: true,
        liveness: true,
        idFace: true,
        profileFace: true,
        dateOfBirth: true,
        gender: true,
        country: true,
      },
      decision: {
        poa: {
          status: "Approved",
          poa_address: "private address",
          issue_date: "2026-09-01",
          warnings: [],
        },
      },
    });
    const stages = upsertDerivedStageResult.mock.calls.map((call) => call[0].stage);
    expect(stages).toEqual(["identity"]);
  });

  it("writes a Smile outcome through as identity evidence only", async () => {
    vi.stubEnv("AUTH_SECRET", "test-only-ingestion-binding-secret-long-enough");
    const upsertDerivedStageResult = vi.fn().mockResolvedValue(undefined);
    const ensureProviderAttempt = vi.fn().mockResolvedValue(undefined);
    const service = new KycIngestionService({
      ensureProviderAttempt,
      upsertDerivedStageResult,
    } as unknown as KycRepository);
    await service.recordSmileIdentityDecision({
      userId: "member-1",
      attemptId: "00000000-0000-4000-8000-000000000002",
      providerReference: "job-1",
      bronzeStatus: "verified",
      identityChecks: {
        governmentId: true,
        liveness: true,
        idFace: true,
        profileFace: true,
        dateOfBirth: true,
        gender: true,
        country: true,
      },
      verifiedIdentity: { fullName: "MEMBER NAME", dateOfBirth: "1990-02-03", gender: "female" },
    });
    expect(ensureProviderAttempt).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000002",
      userId: "member-1",
      provider: "smile",
      providerReference: "job-1",
    });
    expect(upsertDerivedStageResult).toHaveBeenCalledTimes(1);
    expect(upsertDerivedStageResult).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "identity", status: "passed" }),
    );
    const persisted = JSON.stringify(upsertDerivedStageResult.mock.calls);
    expect(persisted).not.toContain("MEMBER NAME");
  });

  it("keeps a Smile profile-face gap under review instead of passing identity", async () => {
    const upsertDerivedStageResult = vi.fn().mockResolvedValue(undefined);
    const service = new KycIngestionService({
      ensureProviderAttempt: vi.fn().mockResolvedValue(undefined),
      upsertDerivedStageResult,
    } as unknown as KycRepository);
    await service.recordSmileIdentityDecision({
      userId: "member-1",
      attemptId: "00000000-0000-4000-8000-000000000003",
      providerReference: "job-2",
      bronzeStatus: "manual_review",
      identityChecks: {
        governmentId: true,
        liveness: true,
        idFace: true,
        profileFace: false,
        dateOfBirth: true,
        gender: true,
        country: true,
      },
    });
    expect(upsertDerivedStageResult).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "identity",
        status: "under_review",
        reasonCodes: ["IDENTITY_REVIEW_REQUIRED"],
      }),
    );
  });
});
