import type { KycProgressPM } from "@/domain/kyc";
import { api } from "./apiClient";

export const kycApi = {
  status: () => api.get<KycProgressPM>("/verification/kyc/status"),
  consent: (category: "location" | "residence", policyVersion: string) =>
    api.post("/verification/kyc/consents", { category, policyVersion }),
  submitLocation: (input: { latitude: number; longitude: number; accuracyMetres: number }) =>
    api.post<{ status: string }>("/verification/kyc/location", input),
  refreshResidence: () => api.post<{ status: string }>("/verification/kyc/residence/refresh", {}),
};
