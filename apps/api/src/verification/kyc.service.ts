import { Injectable } from "@nestjs/common";
import type { KycConsentCategory, KycStageStatus } from "../db/schema";
import { BronzeRepository } from "./bronze.repository";
import { canAwardKinkordKyc, KYC_REQUIRED_STAGES, type KycRequiredStage, type KycStageDecision } from "./kyc-policy";
import { KycRepository } from "./kyc.repository";
import { KYC_FINANCIAL_POLICY_VERSION, KycFinancialService } from "./kyc-financial.service";
import { KYC_LOCATION_POLICY_VERSION, KycLocationService } from "./kyc-location.service";

const stageDetails: Record<KycRequiredStage, { title: string; description: string; available: boolean }> = {
  identity: {
    title: "Identity & live biometrics",
    description: "Government ID, live liveness, face match and profile-photo match.",
    available: true,
  },
  location: {
    title: "Live location",
    description: "Consented live-location evidence. This stage is not open yet.",
    available: false,
  },
  residence: {
    title: "Residence",
    description: "Proof-of-address verification. This stage is not open yet.",
    available: false,
  },
  financial: {
    title: "Financial KYC",
    description: "Consent-based bank-account ownership and identity-consistency verification.",
    available: false,
  },
};

const legacyStatus: Record<string, KycStageStatus> = {
  not_started: "not_started",
  pending: "pending",
  failed: "failed",
  manual_review: "under_review",
  verified: "passed",
};

@Injectable()
export class KycService {
  constructor(
    private readonly repository: KycRepository,
    private readonly legacyIdentity: BronzeRepository,
    private readonly location: KycLocationService,
    private readonly financial: KycFinancialService,
  ) {}

  async status(userId: string) {
    const [{ caseRow, results }, legacy, financialAttempt] = await Promise.all([
      this.repository.snapshot(userId), this.legacyIdentity.status(userId), this.repository.latestStageAttempt(userId, "financial"),
    ]);
    const newest = new Map<KycRequiredStage, (typeof results)[number]>();
    for (const result of results) {
      const stage = result.stage as KycRequiredStage;
      if (KYC_REQUIRED_STAGES.includes(stage) && !newest.has(stage)) newest.set(stage, result);
    }

    const decisions = KYC_REQUIRED_STAGES.map((stage): KycStageDecision => {
      const result = newest.get(stage);
      if (result) {
        return {
          stage,
          status: result.status,
          checks: stage === "identity" ? result.summary as KycStageDecision["checks"] : undefined,
          expiresAt: result.expiresAt,
        };
      }
      if (stage === "identity" && legacy) {
        return {
          stage,
          status: legacyStatus[legacy.status] ?? "not_started",
          // A legacy verified result already passed all identity checks, but it
          // is deliberately insufficient to award full Kinkord KYC by itself.
          checks: legacy.status === "verified"
            ? { governmentId: true, liveness: true, idFace: true, profileFace: true, identityDetails: true }
            : undefined,
        };
      }
      if (stage === "financial" && financialAttempt?.status === "pending") return { stage, status: "pending" };
      return { stage, status: "not_started" };
    });

    const verified = canAwardKinkordKyc(decisions);
    return {
      status: verified ? "verified" : caseRow.status,
      fullKycVerified: verified,
      stages: decisions.map((decision) => ({
        key: decision.stage,
        ...stageDetails[decision.stage],
        available: decision.stage === "location" ? this.location.enabled
          : decision.stage === "financial" ? this.financial.enabled : stageDetails[decision.stage].available,
        status: decision.status,
        expiresAt: decision.expiresAt?.toISOString() ?? null,
      })),
      locationPolicyVersion: this.location.enabled ? KYC_LOCATION_POLICY_VERSION : null,
      financialPolicyVersion: this.financial.enabled ? KYC_FINANCIAL_POLICY_VERSION : null,
    };
  }

  async consent(userId: string, category: KycConsentCategory, policyVersion: string) {
    return this.repository.recordConsent({ userId, category, policyVersion });
  }
}
