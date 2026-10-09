/**
 * The active Kinkord KYC contract. Financial verification is intentionally
 * paused and therefore cannot block or contribute to the verification seal.
 */
export const KYC_REQUIRED_STAGES = ["identity", "location", "residence"] as const;

/** Consent version a member must accept before proof-of-address evidence is stored. */
export const KYC_RESIDENCE_POLICY_VERSION = "kyc-residence-2026-09-22-v1";

export type KycRequiredStage = (typeof KYC_REQUIRED_STAGES)[number];
export type KycDecisionStatus = "not_started" | "pending" | "passed" | "failed" | "under_review" | "unavailable" | "expired";

/** The provider environment a stage result was recorded under (sandbox vs live). */
export function kycProviderEnvironment() {
  return process.env.DIDIT_MODE?.trim() === "sandbox" ? "sandbox" : "live";
}

/** Fail closed: a result stamped for another environment never counts toward the seal. */
export function kycResultEnvironment(summary: Record<string, boolean | number | string> | null | undefined) {
  const environment = summary?.environment;
  return typeof environment === "string" && environment ? environment : null;
}

export interface KycStageDecision {
  stage: KycRequiredStage;
  status: KycDecisionStatus;
  /** Identity needs its component checks; other stages are provider-policy decisions. */
  checks?: Partial<Record<"governmentId" | "liveness" | "idFace" | "profileFace" | "identityDetails", boolean>>;
  expiresAt?: Date | null;
  /** Environment stamp carried from the stored summary; null never seals. */
  environment?: string | null;
}

const identityChecks = ["governmentId", "liveness", "idFace", "profileFace", "identityDetails"] as const;

export function identityDecisionPasses(decision: KycStageDecision | undefined): boolean {
  return decision?.stage === "identity" && decision.status === "passed" &&
    identityChecks.every((check) => decision.checks?.[check] === true);
}

function stageSeals(decision: KycStageDecision | undefined, now: Date): boolean {
  if (!decision || decision.status !== "passed" || (decision.expiresAt && decision.expiresAt <= now)) return false;
  if (decision.environment !== kycProviderEnvironment()) return false;
  return decision.stage !== "identity" || identityDecisionPasses(decision);
}

/**
 * A Kinkord KYC seal is fail-closed: every required stage must pass, be
 * unexpired, and carry the current provider environment stamp. This prevents a
 * provider's partial identity decision or non-live evidence from becoming a
 * full KYC approval.
 */
export function canAwardKinkordKyc(decisions: KycStageDecision[], now = new Date()): boolean {
  const newestByStage = new Map<KycRequiredStage, KycStageDecision>();
  for (const decision of decisions) newestByStage.set(decision.stage, decision);
  return KYC_REQUIRED_STAGES.every((stage) => stageSeals(newestByStage.get(stage), now));
}

export function nextRequiredKycStage(decisions: KycStageDecision[], now = new Date()): KycRequiredStage | null {
  const newestByStage = new Map<KycRequiredStage, KycStageDecision>();
  for (const decision of decisions) newestByStage.set(decision.stage, decision);
  return KYC_REQUIRED_STAGES.find((stage) => !stageSeals(newestByStage.get(stage), now)) ?? null;
}
