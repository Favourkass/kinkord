import { describe, expect, it } from "vitest";
import { canAwardKinkordKyc, nextRequiredKycStage, type KycStageDecision } from "./kyc-policy";

const allPassed = (): KycStageDecision[] => [
  { stage: "identity", status: "passed", checks: { governmentId: true, liveness: true, idFace: true, profileFace: true, identityDetails: true } },
  { stage: "location", status: "passed" },
  { stage: "residence", status: "passed" },
  { stage: "financial", status: "passed" },
];

describe("Kinkord KYC policy", () => {
  it("does not award KYC when identity is the only completed stage", () => {
    expect(canAwardKinkordKyc([allPassed()[0]])).toBe(false);
    expect(nextRequiredKycStage([allPassed()[0]])).toBe("location");
  });

  it("requires every identity component even when the provider stage says passed", () => {
    const decisions = allPassed();
    decisions[0] = { ...decisions[0], checks: { ...decisions[0].checks, liveness: false } };
    expect(canAwardKinkordKyc(decisions)).toBe(false);
    expect(nextRequiredKycStage(decisions)).toBe("identity");
  });

  it("refuses an expired stage and otherwise requires all four stages", () => {
    const decisions = allPassed();
    expect(canAwardKinkordKyc(decisions)).toBe(true);
    decisions[2] = { ...decisions[2], expiresAt: new Date("2026-01-01T00:00:00.000Z") };
    expect(canAwardKinkordKyc(decisions, new Date("2026-09-21T00:00:00.000Z"))).toBe(false);
    expect(nextRequiredKycStage(decisions, new Date("2026-09-21T00:00:00.000Z"))).toBe("residence");
  });
});
