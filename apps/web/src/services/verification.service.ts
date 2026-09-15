import { api, ApiError } from "./apiClient";

/** Which contact point is being proved. */
export type VerificationChannel = "phone" | "email";

export interface CodeSentPM {
  otpId: string;
  /** Already masked by the API — the raw number or address never comes back. */
  sentTo: string;
  expiresAt: string;
  resendAfterMs: number;
}

export interface VerifiedPM {
  verified: boolean;
  attemptsLeft: number | null;
}

export const verificationApi = {
  sendCode: (channel: VerificationChannel) =>
    api.post<CodeSentPM>(`/profile/${channel}/send-code`, {}),
  verify: (channel: VerificationChannel, otpId: string, code: string) =>
    api.post<VerifiedPM>(`/profile/${channel}/verify`, { otpId, code }),
};

/**
 * Turns a failed verification into something worth reading. 429 covers both the
 * resend cooldown and the three-strike lockout, and the API's own wording says
 * which, so it is passed through rather than replaced.
 */
export function verificationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    // Transport failures carry the message directly (apiClient uses status 0).
    if (typeof error.body === "string" && error.body.length > 0) return error.body;
    const body = error.body as { message?: unknown } | null;
    if (typeof body?.message === "string" && body.message.length > 0) return body.message;
    // An ApiError's own message is "HTTP 500" — never put that in front of a member.
    return fallback;
  }
  return fallback;
}

/** "2 attempts left" is worth saying; the last one is said differently. */
export function attemptsMessage(attemptsLeft: number | null) {
  if (attemptsLeft === null) return null;
  if (attemptsLeft <= 0) return null;
  return attemptsLeft === 1
    ? "That code was wrong. One more try before the number is locked for 24 hours."
    : `That code was wrong. ${attemptsLeft} tries left.`;
}
