export type KycReviewStage = "location" | "residence" | "financial";

export interface KycReviewPM {
  id: string;
  caseUserId: string;
  attemptId: string | null;
  stage: KycReviewStage;
  reasonCodes: string[];
  createdAt: string;
  provider: string | null;
  providerReference: string | null;
  summary: Record<string, boolean | number | string> | null;
}

export interface KycReviewDecisionPM {
  status: "passed" | "failed";
}
