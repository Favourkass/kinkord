import { describe, expect, it } from "vitest";
import { KycRepository } from "./kyc.repository";
import { KycService } from "./kyc.service";
import { BronzeRepository } from "./bronze.repository";
import { KycLocationService } from "./kyc-location.service";
import { KycFinancialService } from "./kyc-financial.service";

function subject(input: { legacyStatus?: string; results?: unknown[] } = {}) {
  const repository = {
    snapshot: async () => ({ caseRow: { status: "not_started" }, results: input.results ?? [] }),
    recordConsent: async () => null,
    latestStageAttempt: async () => null,
  } as unknown as KycRepository;
  const legacy = {
    status: async () => (input.legacyStatus ? { status: input.legacyStatus } : null),
  } as unknown as BronzeRepository;
  return new KycService(
    repository,
    legacy,
    { enabled: false } as unknown as KycLocationService,
    { enabled: false } as unknown as KycFinancialService,
  );
}

describe("KycService", () => {
  it("uses a legacy approval as identity evidence without promoting it to full KYC", async () => {
    const view = await subject({ legacyStatus: "verified" }).status("member-1");
    expect(view.fullKycVerified).toBe(false);
    expect(view.stages.find((stage) => stage.key === "identity")?.status).toBe("passed");
    expect(view.stages.find((stage) => stage.key === "financial")?.status).toBe("not_started");
    expect(await subject({ legacyStatus: "verified" }).isFullyVerified("member-1")).toBe(false);
  });

  it("keeps sensitive future stages unavailable until providers are approved", async () => {
    const view = await subject().status("member-1");
    expect(view.stages.find((stage) => stage.key === "location")?.available).toBe(false);
    expect(view.stages.find((stage) => stage.key === "financial")?.available).toBe(false);
  });

  it("never reports verified for a revoked case even when stages passed", async () => {
    const environment = process.env.DIDIT_MODE?.trim() === "sandbox" ? "sandbox" : "live";
    const results = (["identity", "location", "residence", "financial"] as const).map((stage) => ({
      stage,
      status: "passed",
      expiresAt: null,
      summary:
        stage === "identity"
          ? {
              governmentId: true,
              liveness: true,
              idFace: true,
              profileFace: true,
              identityDetails: true,
              environment,
            }
          : { environment },
    }));
    const repository = {
      snapshot: async () => ({
        caseRow: { status: "revoked", revokedAt: new Date(), expiresAt: null },
        results,
      }),
      recordConsent: async () => null,
      latestStageAttempt: async () => null,
    } as unknown as import("./kyc.repository").KycRepository;
    const legacy = {
      status: async () => null,
    } as unknown as import("./bronze.repository").BronzeRepository;
    const service = new KycService(
      repository,
      legacy,
      { enabled: false } as unknown as import("./kyc-location.service").KycLocationService,
      { enabled: false } as unknown as import("./kyc-financial.service").KycFinancialService,
    );
    const view = await service.status("member-1");
    expect(view.fullKycVerified).toBe(false);
    expect(view.status).toBe("revoked");
    expect(await service.isFullyVerified("member-1")).toBe(false);
  });
});
