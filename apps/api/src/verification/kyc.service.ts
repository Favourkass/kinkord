import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { KycStageStatus } from "../db/schema";
import { BronzeRepository } from "./bronze.repository";
import {
  canAwardKinkordKyc,
  KYC_REQUIRED_STAGES,
  KYC_RESIDENCE_POLICY_VERSION,
  kycResultEnvironment,
  type KycRequiredStage,
  type KycStageDecision,
} from "./kyc-policy";
import { KycRepository } from "./kyc.repository";
import { KYC_FINANCIAL_POLICY_VERSION, KycFinancialService } from "./kyc-financial.service";
import { KYC_LOCATION_POLICY_VERSION, KycLocationService } from "./kyc-location.service";
import { DiditService } from "./didit.service";
import { KycIngestionService } from "./kyc-ingestion.service";

type KycStageConsentCategory = "location" | "residence" | "financial";

const consentPolicyVersions: Record<KycStageConsentCategory, string> = {
  location: KYC_LOCATION_POLICY_VERSION,
  residence: KYC_RESIDENCE_POLICY_VERSION,
  financial: KYC_FINANCIAL_POLICY_VERSION,
};

const stageDetails: Record<
  KycRequiredStage,
  { title: string; description: string; available: boolean }
> = {
  identity: {
    title: "Identity & live biometrics",
    description: "Government ID, live liveness, face match and profile-photo match.",
    available: true,
  },
  location: {
    title: "Live location",
    description: "Consented live-location evidence compared with your approved proof of address.",
    available: false,
  },
  residence: {
    title: "Residence",
    description:
      "Proof-of-address verification. Submit a recent document through the identity session.",
    available: true,
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
    private readonly didit: DiditService,
    private readonly ingestion: KycIngestionService,
  ) {}

  private async buildDecisions(userId: string) {
    const [{ caseRow, results }, legacy, financialAttempt] = await Promise.all([
      this.repository.snapshot(userId),
      this.legacyIdentity.status(userId),
      this.repository.latestStageAttempt(userId, "financial"),
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
          checks: stage === "identity" ? (result.summary as KycStageDecision["checks"]) : undefined,
          expiresAt: result.expiresAt,
          environment: kycResultEnvironment(result.summary),
        };
      }
      if (stage === "identity" && legacy) {
        return {
          stage,
          status: legacyStatus[legacy.status] ?? "not_started",
          // A legacy verified result already passed all identity checks, but it
          // is deliberately insufficient to award full Kinkord KYC by itself.
          checks:
            legacy.status === "verified"
              ? {
                  governmentId: true,
                  liveness: true,
                  idFace: true,
                  profileFace: true,
                  identityDetails: true,
                }
              : undefined,
          // Legacy Bronze was recorded before environment stamping; it never
          // seals on its own and must not borrow a live/sandbox stamp here.
          environment: null,
        };
      }
      if (stage === "financial" && financialAttempt?.status === "pending")
        return { stage, status: "pending" };
      return { stage, status: "not_started" };
    });
    return { caseRow, decisions };
  }

  async status(userId: string) {
    const [{ caseRow, decisions }, locationConsented, residenceConsented, financialConsented] =
      await Promise.all([
        this.buildDecisions(userId),
        this.repository.hasActiveConsent(userId, "location", KYC_LOCATION_POLICY_VERSION),
        this.repository.hasActiveConsent(userId, "residence", KYC_RESIDENCE_POLICY_VERSION),
        this.repository.hasActiveConsent(userId, "financial", KYC_FINANCIAL_POLICY_VERSION),
      ]);
    // A revoked or expired case never reports verified, regardless of stage rows.
    const caseActive =
      !caseRow.revokedAt &&
      caseRow.status !== "revoked" &&
      !(caseRow.expiresAt && caseRow.expiresAt <= new Date());
    const verified = caseActive && canAwardKinkordKyc(decisions);
    return {
      status: verified ? "verified" : caseRow.status === "revoked" ? "revoked" : caseRow.status,
      fullKycVerified: verified,
      stages: decisions.map((decision) => ({
        key: decision.stage,
        ...stageDetails[decision.stage],
        available:
          decision.stage === "location"
            ? this.location.enabled
            : decision.stage === "residence"
              ? this.didit.residenceEnabled
              : decision.stage === "financial"
                ? this.financial.enabled
                : stageDetails[decision.stage].available,
        status: decision.status,
        expiresAt: decision.expiresAt?.toISOString() ?? null,
      })),
      locationPolicyVersion: this.location.enabled ? KYC_LOCATION_POLICY_VERSION : null,
      residencePolicyVersion: this.didit.residenceEnabled ? KYC_RESIDENCE_POLICY_VERSION : null,
      financialPolicyVersion: this.financial.enabled ? KYC_FINANCIAL_POLICY_VERSION : null,
      consents: {
        location: locationConsented,
        residence: residenceConsented,
        financial: financialConsented,
      },
    };
  }

  /** Unified public/private seal: policy-service decision plus case-level revocation/expiry. */
  async isFullyVerified(userId: string) {
    const { caseRow, decisions } = await this.buildDecisions(userId);
    if (caseRow.revokedAt || caseRow.status === "revoked") return false;
    if (caseRow.expiresAt && caseRow.expiresAt <= new Date()) return false;
    return canAwardKinkordKyc(decisions);
  }

  async consent(userId: string, category: KycStageConsentCategory, policyVersion: string) {
    if (policyVersion !== consentPolicyVersions[category]) {
      throw new BadRequestException("The current KYC consent version is required.");
    }
    return this.repository.recordConsent({ userId, category, policyVersion });
  }

  /** Re-fetches an authenticated Didit decision after residence consent. Raw
   * proof-of-address data remains in memory and only the derived result is saved. */
  async refreshResidence(userId: string) {
    if (!this.didit.residenceEnabled)
      throw new ServiceUnavailableException("Didit residence verification is not configured.");
    if (
      !(await this.repository.hasActiveConsent(userId, "residence", KYC_RESIDENCE_POLICY_VERSION))
    ) {
      throw new ForbiddenException("Residence consent is required before checking evidence.");
    }
    const attempt = await this.repository.latestStageAttempt(userId, "identity");
    if (!attempt || attempt.provider !== "didit") {
      throw new ConflictException(
        "Complete a Didit identity session with proof of address before checking residence.",
      );
    }
    const decision = await this.didit.decision(attempt.providerSessionReference);
    if (
      decision.session_id !== attempt.providerSessionReference ||
      decision.session_kind !== "user" ||
      decision.vendor_data !== userId ||
      decision.workflow_id !== this.didit.workflowId
    ) {
      throw new BadRequestException("Mismatched Didit residence decision.");
    }
    const result = await this.ingestion.recordDiditResidenceDecision({
      userId,
      attemptId: attempt.id,
      providerReference: attempt.providerSessionReference,
      decision,
    });
    if (!result) {
      throw new ConflictException(
        "The completed Didit workflow has no proof-of-address evidence. Use a workflow with Proof of Address enabled.",
      );
    }
    return { status: result.status };
  }
}
