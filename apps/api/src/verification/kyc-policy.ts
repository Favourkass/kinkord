export const KYC_REQUIRED_STAGES = ["identity", "location", "residence", "financial"] as const;

export type KycRequiredStage = (typeof KYC_REQUIRED_STAGES)[number];
export type KycDecisionStatus = "not_started" | "pending" | "passed" | "failed" | "under_review" | "unavailable" | "expired";

export interface KycStageDecision {
  stage: KycRequiredStage;
  status: KycDecisionStatus;
  /** Identity needs its component checks; other stages are provider-policy decisions. */
  checks?: Partial<Record<"governmentId" | "liveness" | "idFace" | "profileFace" | "identityDetails", boolean>>;
  expiresAt?: Date | null;
}

const identityChecks = ["governmentId", "liveness", "idFace", "profileFace", "identityDetails"] as const;

export function identityDecisionPasses(decision: KycStageDecision | undefined): boolean {
  return decision?.stage === "identity" && decision.status === "passed" &&
    identityChecks.every((check) => decision.checks?.[check] === true);
}

/**
 * A Kinkord KYC seal is fail-closed: every required, non-expired stage must
 * pass. This prevents a provider's partial identity decision from becoming a
 * full KYC approval.
 */
export function canAwardKinkordKyc(decisions: KycStageDecision[], now = new Date()): boolean {
  const newestByStage = new Map<KycRequiredStage, KycStageDecision>();
  for (const decision of decisions) newestByStage.set(decision.stage, decision);
  return KYC_REQUIRED_STAGES.every((stage) => {
    const decision = newestByStage.get(stage);
    if (!decision || decision.status !== "passed" || (decision.expiresAt && decision.expiresAt <= now)) return false;
    return stage !== "identity" || identityDecisionPasses(decision);
  });
}

export function nextRequiredKycStage(decisions: KycStageDecision[], now = new Date()): KycRequiredStage | null {
  const newestByStage = new Map<KycRequiredStage, KycStageDecision>();
  for (const decision of decisions) newestByStage.set(decision.stage, decision);
  return KYC_REQUIRED_STAGES.find((stage) => {
    const decision = newestByStage.get(stage);
    return stage === "identity"
      ? !identityDecisionPasses(decision) || Boolean(decision?.expiresAt && decision.expiresAt <= now)
      : decision?.status !== "passed" || Boolean(decision.expiresAt && decision.expiresAt <= now);
  }) ?? null;
}
