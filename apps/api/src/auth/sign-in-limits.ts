import { createHmac } from "node:crypto";
import { APIError, isAPIError } from "better-auth/api";
import { and, count, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { signInFailure, user } from "../db/schema";
import { clientIpFrom } from "../moderation/signup-rules";

/**
 * Wrong-password limits for every way in: email, username and phone. Better
 * Auth's own rate limit only sees requests that arrive over HTTP, so the phone
 * route, which signs in in-process, had none. Failures are counted in the
 * database, so every API instance shares them.
 */
export const ACCOUNT_MAX_FAILURES = 5;
/** Generous, because a mobile network can put many members behind one address. */
export const NETWORK_MAX_FAILURES = 50;
export const FAILURE_WINDOW_MINUTES = 15;
export const TOO_MANY_ATTEMPTS = `Too many sign-in attempts. Try again in ${FAILURE_WINDOW_MINUTES} minutes.`;

/** Better Auth's password sign-ins. Phone sign-in reaches /sign-in/email in-process. */
export const PASSWORD_SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  "/sign-in/email",
  "/sign-in/username",
]);

export interface SignInKeys {
  account: string | null;
  network: string | null;
}

const WINDOW = sql.raw(`now() - interval '${FAILURE_WINDOW_MINUTES} minutes'`);

export const accountKey = (userId: string) => `user:${userId}`;

export function networkKey(ip: string | null): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!ip || !secret) return null;
  return `ip:${createHmac("sha256", secret).update(ip).digest("hex")}`;
}

/** The account a password sign-in names, by email or username; null when there's none. */
export async function accountFor(db: Db, path: string, body: unknown): Promise<string | null> {
  const fields = (body ?? {}) as { email?: unknown; username?: unknown };
  const where =
    path === "/sign-in/email" && typeof fields.email === "string"
      ? eq(user.email, fields.email.trim().toLowerCase())
      : path === "/sign-in/username" && typeof fields.username === "string"
        ? eq(user.username, fields.username.trim().toLowerCase())
        : null;
  if (!where) return null;
  const [row] = await db.select({ id: user.id }).from(user).where(where).limit(1);
  return row ? accountKey(row.id) : null;
}

/** Whether the account, or the network, has used up its wrong passwords in the window. */
export async function signInBlocked(db: Db, keys: SignInKeys): Promise<boolean> {
  const wanted = [keys.account, keys.network].filter((key): key is string => Boolean(key));
  if (wanted.length === 0) return false;
  const rows = await db
    .select({ key: signInFailure.key, n: count() })
    .from(signInFailure)
    .where(and(inArray(signInFailure.key, wanted), gt(signInFailure.createdAt, WINDOW)))
    .groupBy(signInFailure.key);
  return rows.some(
    (row) => row.n >= (row.key === keys.account ? ACCOUNT_MAX_FAILURES : NETWORK_MAX_FAILURES),
  );
}

export async function recordSignInFailure(db: Db, keys: SignInKeys): Promise<void> {
  const rows = [keys.account, keys.network]
    .filter((key): key is string => Boolean(key))
    .map((key) => ({ key }));
  if (rows.length === 0) return;
  await db.insert(signInFailure).values(rows);
  // Rows only matter inside the window; clear out old ones now and then instead of on a timer.
  if (Math.random() < 0.05) {
    await db
      .delete(signInFailure)
      .where(lt(signInFailure.createdAt, sql`now() - interval '1 day'`));
  }
}

/** The right password starts the account's count again. */
export async function clearSignInFailures(db: Db, account: string | null): Promise<void> {
  if (account) await db.delete(signInFailure).where(eq(signInFailure.key, account));
}

/** What the Better Auth hooks below read from a request. */
export interface SignInHookContext {
  path: string;
  body?: unknown;
  headers?: Headers;
  context: { returned?: unknown };
}

/** Before a password sign-in: refuse while the account or network is over its limit. */
export async function guardPasswordSignIn(db: Db, ctx: SignInHookContext): Promise<void> {
  if (!PASSWORD_SIGN_IN_PATHS.has(ctx.path)) return;
  const keys = {
    account: await accountFor(db, ctx.path, ctx.body),
    network: networkKey(clientIpFrom(ctx.headers)),
  };
  if (await signInBlocked(db, keys)) {
    throw new APIError("TOO_MANY_REQUESTS", { message: TOO_MANY_ATTEMPTS });
  }
}

/** After one: a wrong password counts, the right one clears the account's count. */
export async function countPasswordSignIn(db: Db, ctx: SignInHookContext): Promise<void> {
  if (!PASSWORD_SIGN_IN_PATHS.has(ctx.path)) return;
  const returned = ctx.context.returned;
  const account = await accountFor(db, ctx.path, ctx.body);
  if (!isAPIError(returned)) await clearSignInFailures(db, account);
  else if (returned.statusCode === 401) {
    await recordSignInFailure(db, { account, network: networkKey(clientIpFrom(ctx.headers)) });
  }
}
