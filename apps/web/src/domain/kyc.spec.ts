import { describe, expect, it } from "vitest";
import type { KycProgressPM } from "./kyc";

describe("KYC progress contract", () => {
  it("carries stage availability and completion", () => {
    const progress: KycProgressPM = {
      status: "in_progress",
      fullKycVerified: false,
      locationPolicyVersion: "location-v1",
      residencePolicyVersion: null,
      consents: { location: true, residence: false },
      stages: [
        {
          key: "identity",
          title: "Identity",
          description: "Government ID and live biometric",
          available: true,
          status: "passed",
          expiresAt: null,
        },
      ],
    };
    expect(progress.stages[0]).toMatchObject({ key: "identity", status: "passed" });
    expect(progress.fullKycVerified).toBe(false);
    expect(progress.consents.location).toBe(true);
  });
});
