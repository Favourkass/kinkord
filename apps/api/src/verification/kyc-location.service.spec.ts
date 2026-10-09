import { describe, expect, it, vi } from "vitest";
import { DiditService } from "./didit.service";
import { KycLocationService, kilometreDistance, KYC_LOCATION_POLICY_VERSION } from "./kyc-location.service";
import { KycRepository } from "./kyc.repository";

describe("KycLocationService", () => {
  it("calculates a short geographic distance without persisting coordinates", () => {
    expect(kilometreDistance({ latitude: 6.5244, longitude: 3.3792 }, { latitude: 6.5244, longitude: 3.3792 })).toBe(0);
  });

  it("stores only a derived pass/fail location outcome", async () => {
    vi.stubEnv("KYC_LOCATION_ENABLED", "true");
    const hasActiveConsent = vi.fn().mockResolvedValue(true);
    const latestDiditResidenceAttempt = vi.fn().mockResolvedValue({ id: "attempt-1", providerSessionReference: "session-1" });
    const upsertDerivedStageResult = vi.fn().mockResolvedValue(undefined);
    const decision = vi.fn().mockResolvedValue({ poa: {
      poa_parsed_address: { raw_results: { geometry: { location: { lat: 6.5244, lng: 3.3792 } } } },
    } });
    const service = new KycLocationService(
      { hasActiveConsent, latestDiditResidenceAttempt, upsertDerivedStageResult } as unknown as KycRepository,
      { configured: true, residenceEnabled: true, decision } as unknown as DiditService,
    );
    await expect(service.capture("member-1", { latitude: 6.5245, longitude: 3.3793, accuracyMetres: 15 }))
      .resolves.toEqual({ status: "passed" });
    expect(hasActiveConsent).toHaveBeenCalledWith("member-1", "location", KYC_LOCATION_POLICY_VERSION);
    const persisted = JSON.stringify(upsertDerivedStageResult.mock.calls);
    expect(persisted).not.toContain("6.5244");
    expect(persisted).not.toContain("3.3792");
    expect(upsertDerivedStageResult).toHaveBeenCalledWith(expect.objectContaining({ stage: "location", status: "passed" }));
  });
});
