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
    status: async () => input.legacyStatus ? { status: input.legacyStatus } : null,
  } as unknown as BronzeRepository;
  return new KycService(repository, legacy, { enabled: false } as unknown as KycLocationService,
    { enabled: false } as unknown as KycFinancialService);
}

describe("KycService", () => {
  it("uses a legacy approval as identity evidence without promoting it to full KYC", async () => {
    const view = await subject({ legacyStatus: "verified" }).status("member-1");
    expect(view.fullKycVerified).toBe(false);
    expect(view.stages.find((stage) => stage.key === "identity")?.status).toBe("passed");
    expect(view.stages.find((stage) => stage.key === "financial")?.status).toBe("not_started");
  });

  it("keeps sensitive future stages unavailable until providers are approved", async () => {
    const view = await subject().status("member-1");
    expect(view.stages.find((stage) => stage.key === "location")?.available).toBe(false);
    expect(view.stages.find((stage) => stage.key === "residence")?.available).toBe(false);
    expect(view.stages.find((stage) => stage.key === "financial")?.available).toBe(false);
  });
});
