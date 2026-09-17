import type { BronzeLaunchPM, BronzeVerificationPM } from "@/domain/bronzeVerification";
import { api } from "./apiClient";

export const bronzeVerificationApi = {
  status: () => api.get<BronzeVerificationPM>("/verification/bronze/status"),
  consent: (policyVersion: string) => api.post<BronzeVerificationPM>("/verification/bronze/consent", { accepted: true, policyVersion }),
  start: () => api.post<BronzeLaunchPM>("/verification/bronze/attempts", {}),
};
