import type { KycReviewDecisionPM, KycReviewPM } from "@/domain/kycReview";
import { api } from "./apiClient";

export const kycReviewApi = {
  list: () => api.get<KycReviewPM[]>("/verification/kyc/reviews"),
  decide: (id: string, input: { decision: "approve" | "reject"; evidenceReference: string; reason: string }) =>
    api.post<KycReviewDecisionPM>(`/verification/kyc/reviews/${encodeURIComponent(id)}/decision`, input),
};
