import { describe, expect, it } from "vitest";
import type { KycReviewDecisionPM, KycReviewPM } from "./kycReview";

describe("KYC review contracts", () => {
  it("represents stage-scoped evidence without raw sensitive data", () => {
    const review: KycReviewPM = {
      id: "review-1",
      caseUserId: "user-1",
      attemptId: "attempt-1",
      stage: "financial",
      reasonCodes: ["IDENTITY_MISMATCH"],
      createdAt: "2026-10-02T00:00:00.000Z",
      provider: "mono",
      providerReference: "mono-ref",
      summary: { dateOfBirthMatch: false },
    };
    const decision: KycReviewDecisionPM = { status: "failed" };
    expect(review.stage).toBe("financial");
    expect(decision.status).toBe("failed");
  });
});
