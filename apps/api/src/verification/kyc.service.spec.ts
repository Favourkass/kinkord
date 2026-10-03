import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { KycRepository } from "./kyc.repository";
import { KycService } from "./kyc.service";
import { BronzeRepository } from "./bronze.repository";
import { KycLocationService } from "./kyc-location.service";
import { KycFinancialService } from "./kyc-financial.service";
import { DiditService } from "./didit.service";
import { KycIngestionService } from "./kyc-ingestion.service";

function subject(input: { legacyStatus?: string; results?: unknown[] } = {}) {
  const repository = {
    snapshot: async () => ({ caseRow: { status: "not_started" }, results: input.results ?? [] }),
    recordConsent: async () => null,
    latestStageAttempt: async () => null,
    hasActiveConsent: async () => false,
  } as unknown as KycRepository;
  const legacy = {
    status: async () => (input.legacyStatus ? { status: input.legacyStatus } : null),
  } as unknown as BronzeRepository;
  return new KycService(
    repository,
    legacy,
    { enabled: false } as unknown as KycLocationService,
    { enabled: false } as unknown as KycFinancialService,
    { configured: false, residenceEnabled: false } as unknown as DiditService,
    {} as KycIngestionService,
  );
}

describe("KycService", () => {
  it("uses a legacy approval as identity evidence without promoting it to full KYC", async () => {
    const view = await subject({ legacyStatus: "verified" }).status("member-1");
    expect(view.fullKycVerified).toBe(false);
    expect(view.stages.find((stage) => stage.key === "identity")?.status).toBe("passed");
    expect(view.stages.find((stage) => stage.key === "financial")?.status).toBe("not_started");
    expect(view.consents).toEqual({ location: false, residence: false, financial: false });
    expect(await subject({ legacyStatus: "verified" }).isFullyVerified("member-1")).toBe(false);
  });

  it("keeps sensitive future stages unavailable until providers are approved", async () => {
    const view = await subject().status("member-1");
    expect(view.stages.find((stage) => stage.key === "location")?.available).toBe(false);
    expect(view.stages.find((stage) => stage.key === "residence")?.available).toBe(false);
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
      hasActiveConsent: async () => false,
    } as unknown as import("./kyc.repository").KycRepository;
    const legacy = {
      status: async () => null,
    } as unknown as import("./bronze.repository").BronzeRepository;
    const service = new KycService(
      repository,
      legacy,
      { enabled: false } as unknown as import("./kyc-location.service").KycLocationService,
      { enabled: false } as unknown as import("./kyc-financial.service").KycFinancialService,
      {
        configured: false,
        residenceEnabled: false,
      } as unknown as import("./didit.service").DiditService,
      {} as import("./kyc-ingestion.service").KycIngestionService,
    );
    const view = await service.status("member-1");
    expect(view.fullKycVerified).toBe(false);
    expect(view.status).toBe("revoked");
    expect(await service.isFullyVerified("member-1")).toBe(false);
  });

  it("rejects stale consent versions instead of recording unusable consent", async () => {
    const service = subject();
    await expect(service.consent("member-1", "residence", "old-policy")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("re-fetches correlated Didit PoA evidence after late residence consent", async () => {
    const repository = {
      hasActiveConsent: vi.fn(async () => true),
      latestStageAttempt: vi.fn(async () => ({
        id: "00000000-0000-4000-8000-000000000001",
        provider: "didit",
        providerSessionReference: "session-1",
      })),
    } as unknown as KycRepository;
    const didit = {
      configured: true,
      residenceEnabled: true,
      workflowId: "workflow-1",
      decision: vi.fn(async () => ({
        session_id: "session-1",
        session_kind: "user",
        vendor_data: "member-1",
        workflow_id: "workflow-1",
        poa: { status: "Approved" },
      })),
    } as unknown as DiditService;
    const ingestion = {
      recordDiditResidenceDecision: vi.fn(async () => ({ status: "passed" })),
    } as unknown as KycIngestionService;
    const service = new KycService(
      repository,
      {} as BronzeRepository,
      {} as KycLocationService,
      {} as KycFinancialService,
      didit,
      ingestion,
    );

    await expect(service.refreshResidence("member-1")).resolves.toEqual({ status: "passed" });
    expect(ingestion.recordDiditResidenceDecision).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "member-1", providerReference: "session-1" }),
    );
  });
});
