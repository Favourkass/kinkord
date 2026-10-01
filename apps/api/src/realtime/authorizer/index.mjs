// AppSync Events authorizer for Kinkord's realtime chat. Plain JavaScript with
// no bundled dependencies, so CDK ships this folder as it is (the Lambda
// runtime provides the AWS SDK). The API signs the tokens in ../token.ts; the
// format and channel naming here must match it, which authorizer.spec.ts checks.
import { createHmac, timingSafeEqual } from "node:crypto";

const SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,48}[A-Za-z0-9])?$/;

/** A member's own channel, named exactly as the API names it. */
export function channelFor(userId) {
  return typeof userId === "string" && SEGMENT.test(userId) ? `/chat/${userId}` : null;
}

/** The token's claims if the signature is ours and it hasn't expired; else null. */
export function verify(token, key, nowMs) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const expected = createHmac("sha256", key).update(`v1.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claims?.sub !== "string" || typeof claims?.exp !== "number") return null;
  return claims.exp * 1000 > nowMs ? claims : null;
}

/** The longest AppSync may remember a yes, and never past the token's expiry. */
const MAX_CACHE_SECONDS = 300;

/**
 * Members may connect, and may subscribe only to their own channel. They never
 * publish: the namespace takes publishes from the API's IAM role alone.
 */
export function authorize(event, key, nowMs) {
  const claims = verify(event?.authorizationToken, key, nowMs);
  if (!claims) return { isAuthorized: false };
  const ttlOverride = Math.max(
    0,
    Math.min(MAX_CACHE_SECONDS, Math.floor(claims.exp - nowMs / 1000)),
  );
  const ctx = event.requestContext ?? {};
  if (ctx.operation === "EVENT_CONNECT") return { isAuthorized: true, ttlOverride };
  if (ctx.operation === "EVENT_SUBSCRIBE" && ctx.channel === channelFor(claims.sub)) {
    return { isAuthorized: true, ttlOverride };
  }
  return { isAuthorized: false };
}

let signingKey;

/** The `key` from the kinkord/realtime secret, read once per warm Lambda. */
async function loadKey() {
  if (signingKey) return signingKey;
  const { SecretsManagerClient, GetSecretValueCommand } =
    await import("@aws-sdk/client-secrets-manager");
  const out = await new SecretsManagerClient({}).send(
    new GetSecretValueCommand({ SecretId: process.env.TOKEN_SECRET_ID }),
  );
  signingKey = JSON.parse(out.SecretString).key;
  return signingKey;
}

export async function handler(event) {
  return authorize(event, await loadKey(), Date.now());
}
