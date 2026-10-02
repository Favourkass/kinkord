import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { KycStage } from "../db/schema";
import { KycRepository } from "./kyc.repository";

type Reviewer = { id: string; email: string; twoFactorEnabled?: boolean | null };

const requiredApprovalEvidence: Partial<Record<KycStage, string[]>> = {
  location: ["gpsCaptured", "accuracyAcceptable", "withinResidenceThreshold"],
  residence: [
    "documentApproved",
    "addressExtracted",
    "issueDateExtracted",
    "issueDateWithinPolicy",
    "noIdentityMismatch",
  ],
  financial: ["accountLinked", "financialIdentityAvailable", "identityMatchesKyc"],
};

export function manualApprovalHasRequiredEvidence(
  stage: KycStage,
  summary: Record<string, boolean | number | string>,
) {
  return (requiredApprovalEvidence[stage] ?? []).every((key) => summary[key] === true);
}

@Injectable()
export class KycReviewService {
  constructor(private readonly repository: KycRepository) {}

  private authorize(user: Reviewer) {
    const allowlist = (process.env.KYC_REVIEWER_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean);
    if (!allowlist.includes(user.email.toLocaleLowerCase("en-US")) || !user.twoFactorEnabled) {
      throw new ForbiddenException("KYC review requires an authorized, 2FA-enabled account.");
    }
  }

  async list(user: Reviewer) {
    this.authorize(user);
    return this.repository.openKycReviews();
  }

  async decide(
    user: Reviewer,
    input: {
      id: string;
      decision: "approve" | "reject";
      evidenceReference: string;
      reason: string;
    },
  ) {
    this.authorize(user);
    const context = await this.repository.kycReviewContext(input.id);
    if (
      !context ||
      context.status !== "open" ||
      context.resultStatus !== "under_review" ||
      !context.resultId ||
      !context.assessedAt
    ) {
      throw new ConflictException("The review is no longer open or cannot be decided.");
    }
    if (context.caseUserId === user.id)
      throw new ForbiddenException("Reviewers cannot decide their own KYC case.");
    if (
      input.decision === "approve" &&
      !manualApprovalHasRequiredEvidence(context.stage, context.summary ?? {})
    ) {
      throw new ConflictException(
        "This stage is missing required evidence and cannot be manually approved.",
      );
    }
    const result = await this.repository.decideKycReview({
      ...input,
      reviewerId: user.id,
      expectedResultId: context.resultId,
      expectedAssessedAt: context.assessedAt,
    });
    if (!result) throw new ConflictException("The review is no longer open or cannot be decided.");
    return result;
  }
}
