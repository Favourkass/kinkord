/**
 * Identity verification ("Bronze" in the API): a government ID, a live selfie
 * and a match with the member's profile photo, run by Didit.
 */
export type BronzeStatus =
  | "not_started"
  | "pending"
  | "failed"
  | "manual_review"
  | "verified"
  /** Verified, but the photo, birth date or gender has changed since. */
  | "outdated"
  /** Out of attempts, or turned down by an admin; only an admin can reopen it. */
  | "rejected"
  | "revoked";

/** What the profile still needs before a check can start. */
export type BronzeRequirement = "profilePhoto" | "dateOfBirth" | "gender" | "country";

/** Why the latest attempt didn't pass, in terms safe to show the member. */
export type BronzeFailure =
  | "birth_date"
  | "gender"
  | "registry"
  | "declined"
  | "liveness"
  | "face"
  | "profile_changed"
  | "expired"
  | "other";

/** GET /verification/bronze/status */
export interface BronzeVerificationPM {
  /** False until Kinkord has switched verification on for this member. */
  available: boolean;
  status: BronzeStatus;
  attemptsUsed: number;
  attemptsRemaining: number;
  consented: boolean;
  /** Any active consent version exists and can always be withdrawn. */
  withdrawable: boolean;
  /** The consent wording the API expects; consent is recorded against it. */
  policyVersion: string;
  policyUrl: string | null;
  missing: BronzeRequirement[];
  /** Set while a just-uploaded photo settles; checks can start from then. */
  photoReadyAt: string | null;
  /** The member left Didit's check before finishing; it can be continued. */
  resumable: boolean;
  /** Why the latest attempt didn't pass; only while failed or rejected. */
  lastFailure: BronzeFailure | null;
}

/** POST /verification/bronze/attempts: Didit's hosted check to send the member to. */
export interface BronzeLaunchPM {
  attemptId: string;
  provider: "didit";
  url: string;
}

/** POST /verification/bronze/attempts/resume: the same hosted check, to finish it. */
export interface BronzeResumePM {
  url: string;
}

const STARTABLE: ReadonlySet<BronzeStatus> = new Set(["not_started", "failed", "outdated"]);
/** Closed until an admin reopens it: the member goes through support. */
const CLOSED: ReadonlySet<BronzeStatus> = new Set(["rejected", "revoked"]);
const SHOWS_FAILURE: ReadonlySet<BronzeStatus> = new Set(["failed", "rejected"]);

/** Nothing is in progress or closed, and attempts remain: a check can follow once ready. */
export function hasAttemptOpen(pm: BronzeVerificationPM): boolean {
  return STARTABLE.has(pm.status) && pm.attemptsRemaining > 0;
}

/** Whether the member can begin a check now (consent aside, which starting records). */
export function canStartVerification(pm: BronzeVerificationPM, now = Date.now()): boolean {
  return pm.available && hasAttemptOpen(pm) && pm.missing.length === 0 && !photoSettling(pm, now);
}

/**
 * What the profile still needs, only while a check could follow. A verified
 * member is never told to replace their photo: doing so would end their badge.
 */
export function missingBeforeStart(pm: BronzeVerificationPM): BronzeRequirement[] {
  return pm.available && hasAttemptOpen(pm) ? pm.missing : [];
}

/** The profile photo was uploaded moments ago and can't be checked yet. */
export function photoSettling(pm: BronzeVerificationPM, now = Date.now()): boolean {
  return pm.photoReadyAt !== null && new Date(pm.photoReadyAt).getTime() > now;
}

/** Rejected, revoked or out of attempts: verifying again goes through support. */
export function needsSupportToVerify(pm: BronzeVerificationPM): boolean {
  return CLOSED.has(pm.status) || pm.attemptsRemaining <= 0;
}

/** Why the latest check didn't pass, while that's still where the member stands. */
export function failureReason(pm: BronzeVerificationPM): BronzeFailure | null {
  return SHOWS_FAILURE.has(pm.status) ? (pm.lastFailure ?? null) : null;
}

/**
 * Settings lists Verification while it's open to the member, and also while
 * they have anything there: a status to see, or consent they can withdraw.
 */
export function showsVerificationEntry(
  pm: Pick<BronzeVerificationPM, "available" | "withdrawable" | "status">,
): boolean {
  return pm.available || pm.withdrawable || pm.status !== "not_started";
}

/** Only Didit's hosted check is somewhere we send a member (the API checks this too). */
export function isSafeLaunchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "verify.didit.me";
  } catch {
    return false;
  }
}
