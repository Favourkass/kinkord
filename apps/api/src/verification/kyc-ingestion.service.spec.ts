import { describe, expect, it, vi } from "vitest";
import type { KycRepository } from "./kyc.repository";
import { KycIngestionService } from "./kyc-ingestion.service";

describe("KycIngestionService", () => {
  it("stores derived Didit stage outcomes without sensitive provider data", async () => {
    const upsertDerivedStageResult = vi.fn().mockResolvedValue(undefined);
    const ensureProviderAttempt = vi.fn().mockResolvedValue(undefined);
    const service = new KycIngestionService({ ensureProviderAttempt, upsertDerivedStageResult } as unknown as KycRepository);
    await service.recordDiditDecision({
      userId: "member-1", attemptId: "00000000-0000-4000-8000-000000000001", providerReference: "session-1",
      profileCountry: "NG", providerDeclined: false,
      identityChecks: { governmentId: true, liveness: true, idFace: true, profileFace: true, dateOfBirth: true, gender: true, country: true },
      decision: {
        poa: { status: "Approved", poa_address: "private address", issue_date: "2026-09-01", warnings: [] },
        ip_analyses: [{ status: "Approved", ip_country_code: "NG", latitude: 6.5, longitude: 3.3, is_vpn_or_tor: false, is_data_center: false, warnings: [] }],
      },
    });
    expect(upsertDerivedStageResult).toHaveBeenCalledTimes(3);
    expect(ensureProviderAttempt).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000001", userId: "member-1", provider: "didit", providerReference: "session-1",
    });
    const persisted = JSON.stringify(upsertDerivedStageResult.mock.calls);
    expect(persisted).not.toContain("private address");
    expect(persisted).not.toContain("6.5");
    expect(persisted).not.toContain("3.3");
    expect(upsertDerivedStageResult).toHaveBeenCalledWith(expect.objectContaining({ stage: "identity", status: "passed" }));
    expect(upsertDerivedStageResult).toHaveBeenCalledWith(expect.objectContaining({ stage: "residence", status: "passed" }));
    expect(upsertDerivedStageResult).toHaveBeenCalledWith(expect.objectContaining({ stage: "location", status: "under_review" }));
  });
});
