import { createHmac } from "node:crypto";

/**
 * Realtime connection tokens: `v1.<payload>.<signature>`, base64url, where the
 * signature is HMAC-SHA256 over `v1.<payload>`. The API signs one for a
 * signed-in member; the AppSync authorizer (./authorizer/index.mjs) checks it
 * with the same key. The two must agree; authorizer.spec.ts holds them to it.
 */
export const REALTIME_TOKEN_TTL_SECONDS = 10 * 60;

export interface RealtimeClaims {
  /** The member's user id. */
  sub: string;
  /** Expiry, in Unix seconds. */
  exp: number;
}

export function signRealtimeToken(claims: RealtimeClaims, key: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", key).update(`v1.${payload}`).digest("base64url");
  return `v1.${payload}.${signature}`;
}

/** AppSync channel segments: letters, digits and inner dashes, up to 50. */
const SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,48}[A-Za-z0-9])?$/;

/**
 * The channel a member listens on. Null for an id AppSync can't name, which
 * leaves that member on polling rather than on someone else's channel.
 */
export function channelFor(userId: string): string | null {
  return SEGMENT.test(userId) ? `/chat/${userId}` : null;
}
