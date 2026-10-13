import type {
  BronzeLaunchPM,
  BronzeResumePM,
  BronzeVerificationPM,
} from "@/domain/bronzeVerification";
import { api } from "./apiClient";

/** The member's own identity verification. */
export const bronzeVerificationApi = {
  status: () => api.get<BronzeVerificationPM>("/verification/bronze/status"),
  consent: (policyVersion: string) =>
    api.post<BronzeVerificationPM>("/verification/bronze/consent", {
      accepted: true,
      policyVersion,
    }),
  /** Ends any check and badge, and durably queues the provider-erasure request. */
  withdraw: () => api.post<BronzeVerificationPM>("/verification/bronze/consent/withdraw", {}),
  start: () => api.post<BronzeLaunchPM>("/verification/bronze/attempts", {}),
  /** The unfinished Didit check, to pick up where the member left off (409: nothing to continue). */
  resume: () => api.post<BronzeResumePM>("/verification/bronze/attempts/resume", {}),
};
