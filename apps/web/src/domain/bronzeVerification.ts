export type BronzeStatus = "not_started" | "pending" | "failed" | "manual_review" | "verified";

export interface BronzeVerificationPM {
  status: BronzeStatus;
  attemptsUsed: number;
  attemptsRemaining: number;
  consented: boolean;
  policyVersion: string;
  missing: string[];
  providerAvailable: boolean;
  provider: "didit" | "smile" | null;
  policyUrl: string | null;
}

interface SmileLaunchPM {
  provider: "smile";
  attemptId: string;
  token: string;
  product: "biometric_kyc";
  environment: "sandbox" | "live";
  partnerId: string;
  callbackUrl: string;
  policyUrl: string;
}

interface DiditLaunchPM {
  provider: "didit";
  attemptId: string;
  url: string;
}

export type BronzeLaunchPM = SmileLaunchPM | DiditLaunchPM;

export function bronzeStatusText(status: BronzeStatus): string {
  return {
    not_started: "Not started",
    pending: "In progress — waiting for verification results",
    failed: "Failed — you may try again",
    manual_review: "Manual review required",
    verified: "Bronze verified",
  }[status];
}
