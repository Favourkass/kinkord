import type { KycProgressPM } from "@/domain/kyc";
import { api } from "./apiClient";

export const kycApi = {
  status: () => api.get<KycProgressPM>("/verification/kyc/status"),
  consent: (category: "location" | "residence" | "financial", policyVersion: string) =>
    api.post("/verification/kyc/consents", { category, policyVersion }),
  submitLocation: (input: { latitude: number; longitude: number; accuracyMetres: number }) =>
    api.post<{ status: string }>("/verification/kyc/location", input),
  refreshResidence: () => api.post<{ status: string }>("/verification/kyc/residence/refresh", {}),
  startFinancial: () => api.post<{ url: string }>("/verification/kyc/financial/attempts", {}),
};
