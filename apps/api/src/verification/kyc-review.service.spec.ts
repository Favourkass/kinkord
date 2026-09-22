import { describe, expect, it, vi } from "vitest";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { KycReviewService } from "./kyc-review.service";
import type { KycRepository } from "./kyc.repository";

function subject() {
  const repository = {
    openKycReviews: vi.fn().mockResolvedValue([]),
    kycReviewContext: vi.fn().mockResolvedValue({
      caseUserId: "member-1", stage: "financial", status: "open", resultStatus: "under_review",
      resultId: "result-1", assessedAt: new Date("2026-09-22T10:00:00Z"),
      summary: { accountLinked: true, financialIdentityAvailable: true, identityMatchesKyc: true },
    }),
    decideKycReview: vi.fn().mockResolvedValue({ status: "passed" }),
  };
  return { repository, service: new KycReviewService(repository as unknown as KycRepository) };
}

describe("KycReviewService", () => {
  it("requires both reviewer allowlisting and enabled 2FA", async () => {
    const { service } = subject();
    vi.stubEnv("KYC_REVIEWER_EMAILS", "reviewer@kinkord.com");
    await expect(service.list({ id: "reviewer-1", email: "reviewer@kinkord.com", twoFactorEnabled: false }))
      .rejects.toThrow(ForbiddenException);
  });

  it("records an authorised stage decision through the repository", async () => {
    const { repository, service } = subject();
    vi.stubEnv("KYC_REVIEWER_EMAILS", "reviewer@kinkord.com");
    await expect(service.decide({ id: "reviewer-1", email: "reviewer@kinkord.com", twoFactorEnabled: true }, {
      id: "00000000-0000-4000-8000-000000000001", decision: "approve", evidenceReference: "MONO-CASE-1", reason: "Confirmed in the protected Mono reviewer portal.",
    })).resolves.toEqual({ status: "passed" });
    expect(repository.decideKycReview).toHaveBeenCalledWith(expect.objectContaining({ reviewerId: "reviewer-1", decision: "approve" }));
  });

  it("does not let review override missing GPS evidence", async () => {
    const { repository, service } = subject();
    vi.stubEnv("KYC_REVIEWER_EMAILS", "reviewer@kinkord.com");
    repository.kycReviewContext.mockResolvedValue({
      caseUserId: "member-1", stage: "location", status: "open", resultStatus: "under_review",
      resultId: "result-1", assessedAt: new Date(), summary: { gpsCaptured: false },
    });
    await expect(service.decide({ id: "reviewer-1", email: "reviewer@kinkord.com", twoFactorEnabled: true }, {
      id: "00000000-0000-4000-8000-000000000001", decision: "approve",
      evidenceReference: "DIDIT-CASE-1", reason: "Provider console was inspected but GPS is missing.",
    })).rejects.toThrow(ConflictException);
    expect(repository.decideKycReview).not.toHaveBeenCalled();
  });
});
