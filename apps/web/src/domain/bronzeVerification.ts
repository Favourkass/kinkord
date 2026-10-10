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

/** GET /verification/bronze/status */
export interface BronzeVerificationPM {
  /** False until Kinkord has switched verification on. */
  available: boolean;
  status: BronzeStatus;
  attemptsUsed: number;
  attemptsRemaining: number;
  consented: boolean;
  /** The consent wording the API expects; consent is recorded against it. */
  policyVersion: string;
  policyUrl: string | null;
  missing: BronzeRequirement[];
  /** Set while a just-uploaded photo settles; checks can start from then. */
  photoReadyAt: string | null;
}

/** POST /verification/bronze/attempts: Didit's hosted check to send the member to. */
export interface BronzeLaunchPM {
  attemptId: string;
  provider: "didit";
  url: string;
}

const STARTABLE: ReadonlySet<BronzeStatus> = new Set(["not_started", "failed", "outdated"]);

/** Nothing is in progress or closed, and attempts remain: a check can follow once ready. */
export function hasAttemptOpen(pm: BronzeVerificationPM): boolean {
  return STARTABLE.has(pm.status) && pm.attemptsRemaining > 0;
}

/** Whether the member can begin a check now (consent aside, which starting records). */
export function canStartVerification(pm: BronzeVerificationPM, now = Date.now()): boolean {
  return pm.available && hasAttemptOpen(pm) && pm.missing.length === 0 && !photoSettling(pm, now);
}

/** The profile photo was uploaded moments ago and can't be checked yet. */
export function photoSettling(pm: BronzeVerificationPM, now = Date.now()): boolean {
  return pm.photoReadyAt !== null && new Date(pm.photoReadyAt).getTime() > now;
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
