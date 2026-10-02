import { describe, expect, it } from "vitest";
import type { BronzeReviewDecisionPM, BronzeReviewPM } from "./bronzeReview";

describe("bronze review contracts", () => {
  it("represents a review and its final decision", () => {
    const review: BronzeReviewPM = {
      id: "review-1",
      userId: "user-1",
      attemptId: "attempt-1",
      reasonCodes: ["PROFILE_FACE_REVIEW"],
      createdAt: "2026-10-02T00:00:00.000Z",
      providerJobId: "job-1",
      checks: {
        governmentId: true,
        liveness: true,
        idFace: true,
        profileFace: false,
        dateOfBirth: true,
        gender: true,
        country: true,
      },
      profilePhotoUrl: "https://example.com/avatar.jpg",
    };
    const decision: BronzeReviewDecisionPM = { status: "verified" };

    expect(review.reasonCodes).toContain("PROFILE_FACE_REVIEW");
    expect(decision.status).toBe("verified");
  });
});
