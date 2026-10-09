export type KycStageKey = "identity" | "location" | "residence";
export type KycStageStatus = "not_started" | "pending" | "passed" | "failed" | "under_review" | "unavailable" | "expired";

export interface KycStagePM {
  key: KycStageKey;
  title: string;
  description: string;
  available: boolean;
  status: KycStageStatus;
  expiresAt: string | null;
}

export interface KycProgressPM {
  status: string;
  fullKycVerified: boolean;
  locationPolicyVersion: string | null;
  residencePolicyVersion: string | null;
  consents: {
    location: boolean;
    residence: boolean;
  };
  stages: KycStagePM[];
}
