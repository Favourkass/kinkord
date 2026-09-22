import { Injectable } from "@nestjs/common";
import type { BronzeChecks } from "./bronze-policy";
import { deriveDiditNetworkLocationEvidence, deriveDiditResidenceEvidence } from "./didit-kyc-evidence";
import { kycIdentityBinding } from "./kyc-identity-binding";
import { KycRepository } from "./kyc.repository";

@Injectable()
export class KycIngestionService {
  constructor(private readonly repository: KycRepository) {}

  /**
   * Converts a verified provider decision to KYC stage records. Raw Didit
   * report data never enters Kinkord storage through this method.
   */
  async recordDiditDecision(input: {
    userId: string; attemptId: string; providerReference: string; profileCountry: string;
    decision: Record<string, unknown>; identityChecks: BronzeChecks; providerDeclined: boolean;
    verifiedIdentity?: { fullName: string; dateOfBirth: string; gender: string };
  }) {
    await this.repository.ensureProviderAttempt({
      id: input.attemptId, userId: input.userId, provider: "didit", providerReference: input.providerReference,
    });
    const identityPassed = !input.providerDeclined && Object.values(input.identityChecks).every(Boolean);
    const primaryIdentityPassed = !input.providerDeclined && input.identityChecks.governmentId &&
      input.identityChecks.liveness && input.identityChecks.idFace && input.identityChecks.dateOfBirth &&
      input.identityChecks.gender && input.identityChecks.country;
    const identityBinding = primaryIdentityPassed && input.verifiedIdentity
      ? kycIdentityBinding(input.verifiedIdentity) : null;
    await this.repository.upsertDerivedStageResult({
      userId: input.userId, attemptId: input.attemptId, stage: "identity", provider: "didit",
      providerReference: input.providerReference,
      status: input.providerDeclined ? "failed" : identityPassed ? "passed" : "under_review",
      summary: {
        governmentId: input.identityChecks.governmentId,
        liveness: input.identityChecks.liveness,
        idFace: input.identityChecks.idFace,
        profileFace: input.identityChecks.profileFace,
        identityDetails: input.identityChecks.dateOfBirth && input.identityChecks.gender && input.identityChecks.country,
        ...(identityBinding ? { identityBinding } : {}),
      },
      reasonCodes: input.providerDeclined ? ["DIDIT_IDENTITY_DECLINED"] : identityPassed ? [] : ["IDENTITY_REVIEW_REQUIRED"],
    });

    if (input.decision.poa) {
      const residence = deriveDiditResidenceEvidence(input.decision);
      await this.repository.upsertDerivedStageResult({
        userId: input.userId, attemptId: input.attemptId, stage: "residence", provider: "didit",
        providerReference: input.providerReference, ...residence,
      });
    }
    if (Array.isArray(input.decision.ip_analyses)) {
      const location = deriveDiditNetworkLocationEvidence(input.decision, input.profileCountry);
      await this.repository.upsertDerivedStageResult({
        userId: input.userId, attemptId: input.attemptId, stage: "location", provider: "didit",
        providerReference: input.providerReference, ...location,
      });
    }
  }

  async resolveLegacyIdentityReview(input: { userId: string; attemptId: string; approved: boolean; profileFaceMatches: boolean }) {
    return this.repository.resolveLegacyIdentityReview(input);
  }
}
