import type { BronzeLaunchPM, BronzeVerificationPM } from "@/domain/bronzeVerification";
import { api } from "./apiClient";

/** The member's own identity verification. */
export const bronzeVerificationApi = {
  status: () => api.get<BronzeVerificationPM>("/verification/bronze/status"),
  consent: (policyVersion: string) =>
    api.post<BronzeVerificationPM>("/verification/bronze/consent", {
      accepted: true,
      policyVersion,
    }),
  /** Ends any check and the badge, and erases the member's sessions at Didit. */
  withdraw: () => api.post<BronzeVerificationPM>("/verification/bronze/consent/withdraw", {}),
  start: () => api.post<BronzeLaunchPM>("/verification/bronze/attempts", {}),
};
