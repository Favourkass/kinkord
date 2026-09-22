import type { BronzeChecks } from "./bronzeVerification";

export interface BronzeReviewPM {
  id: string;
  userId: string;
  attemptId: string;
  reasonCodes: string[];
  createdAt: string;
  providerJobId: string;
  checks: BronzeChecks;
  profilePhotoUrl: string;
}

export interface BronzeReviewDecisionPM {
  status: "verified" | "manual_review";
}

