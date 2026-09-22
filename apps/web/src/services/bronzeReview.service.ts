import type { BronzeReviewDecisionPM, BronzeReviewPM } from "@/domain/bronzeReview";
import { api } from "./apiClient";

export interface BronzeReviewDecisionInput {
  decision: "approve" | "reject";
  profileFaceMatches: boolean;
  evidenceReference: string;
  reason: string;
}

export const bronzeReviewApi = {
  list: () => api.get<BronzeReviewPM[]>("/verification/bronze/reviews"),
  decide: (id: string, input: BronzeReviewDecisionInput) =>
    api.post<BronzeReviewDecisionPM>(`/verification/bronze/reviews/${encodeURIComponent(id)}/decision`, input),
};

