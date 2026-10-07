import { and, eq, gt, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/db.module";
import {
  memberSubscription,
  profile,
  user,
  type BillingPeriod,
  type SilverCheckHold,
} from "../db/schema";
import { founderAccount, isSuperAdmin } from "../moderation/admins";

/** What Silver costs until the founders change it on the admin screen (Figma 2:179). */
export const DEFAULT_PRICES: Record<BillingPeriod, { kobo: number; usdCents: number }> = {
  monthly: { kobo: 560_000, usdCents: 400 },
  yearly: { kobo: 3_360_000, usdCents: 2_400 },
};

/** How long the transfer screen counts down before the amount is let go. */
export const PAYMENT_WINDOW_MS = 60 * 60 * 1000;
/**
 * Proof is still taken this long after the countdown ends: banks can be slow,
 * and a member who paid on time shouldn't lose the payment to a dropped app.
 */
export const PROOF_GRACE_MS = 24 * 60 * 60 * 1000;

/** Silver's posts, against POST_BODY_MAX for everyone else. */
export const SILVER_POST_BODY_MAX = 25_000;
/** New chats a Silver member may start a day, against the free allowance of one. */
export const SILVER_NEW_CHATS_PER_DAY = 10;

const LAGOS_UTC_OFFSET_MS = 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** KIN and the Lagos time to the second, the way the design shows it: KIN20260924114238. */
export function paymentReference(at: Date): string {
  const t = new Date(at.getTime() + LAGOS_UTC_OFFSET_MS);
  return `KIN${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}${pad(
    t.getUTCHours(),
  )}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}`;
}

/**
 * The naira added to the price to make an amount unique: two digits while
 * they last, as in the design (₦33,647), then three. Null when all are taken.
 */
export function freeOffset(taken: ReadonlySet<number>, random: () => number): number | null {
  for (const [lo, hi] of [
    [1, 99],
    [100, 999],
  ] as const) {
    const free: number[] = [];
    for (let n = lo; n <= hi; n++) if (!taken.has(n)) free.push(n);
    if (free.length) return free[Math.floor(random() * free.length)];
  }
  return null;
}

/** The dollar figure beside a naira amount, at the plan's own rate: ₦33,647 is $24.03. */
export function usdCentsFor(amountKobo: number, price: { kobo: number; usdCents: number }) {
  return Math.round((amountKobo * price.usdCents) / price.kobo);
}

/** A calendar month or year on; the 31st lands on the month's last day. */
export function addPeriod(from: Date, period: BillingPeriod): Date {
  const months = period === "monthly" ? 1 : 12;
  const target = new Date(from.getTime());
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/** When this member's Silver runs out, or null when they're on Basic. */
export async function silverUntil(db: Db, userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ end: memberSubscription.currentPeriodEnd })
    .from(memberSubscription)
    .where(
      and(
        eq(memberSubscription.userId, userId),
        gt(memberSubscription.currentPeriodEnd, sql`now()`),
      ),
    )
    .limit(1);
  return row?.end ?? null;
}

export async function hasSilver(db: Db, userId: string): Promise<boolean> {
  return (await silverUntil(db, userId)) !== null;
}

/**
 * Days an account must have before its Silver check shows: a new account can't
 * buy one to impersonate. The founders' accounts don't wait.
 */
export const CHECK_MIN_ACCOUNT_DAYS = 30;

/**
 * The founders' Silver doesn't run out: as good as never, for the dates the app
 * shows. Midday, so it reads 31 Dec 2099 in Lagos and everywhere else.
 */
export const FOUNDER_SILVER_UNTIL = new Date("2099-12-31T12:00:00.000Z");
const CHECK_MIN_ACCOUNT_AGE = sql.raw(`interval '${CHECK_MIN_ACCOUNT_DAYS} days'`);

// Aliased so the check can sit inside any query, even one that already reads `user` or `profile`.
const SUB = "check_sub";
const USER = "check_user";
const PROFILE = "check_profile";
const checkSub = alias(memberSubscription, SUB);
const checkUser = alias(user, USER);
const checkProfile = alias(profile, PROFILE);

/**
 * Whether the member with this id shows the Silver check, as an expression to
 * select beside them. The rules are X's: Silver running, the check not held
 * for review since a name or photo change, a profile photo and cover, and an
 * account at least CHECK_MIN_ACCOUNT_DAYS old, unless it's a founder's.
 */
export function silverCheck(userId: AnyColumn | SQL): SQL<boolean> {
  // An alias renders as its bare name in raw SQL, so each table is named with its alias here.
  return sql<boolean>`exists (
    select 1 from ${memberSubscription} ${sql.identifier(SUB)}
    inner join ${user} ${sql.identifier(USER)} on ${checkUser.id} = ${checkSub.userId}
    inner join ${profile} ${sql.identifier(PROFILE)} on ${checkProfile.userId} = ${checkSub.userId}
    where ${checkSub.userId} = ${userId}
      and ${checkSub.currentPeriodEnd} > now()
      and ${checkSub.checkHeldAt} is null
      and ${checkProfile.avatarKey} is not null
      and ${checkProfile.coverKey} is not null
      and (${checkUser.createdAt} <= now() - ${CHECK_MIN_ACCOUNT_AGE} or ${founderAccount(checkUser)})
  )`;
}

/** Why a Silver member's check isn't showing, for their own Silver screen. */
export interface SilverCheckStatus {
  shown: boolean;
  /** held: waiting for an admin after a change. new_account: shows once the account is old enough. */
  reason: "held" | "new_account" | "photos" | null;
  heldFor: SilverCheckHold | null;
  /** When a new account's check appears. */
  showsFrom: Date | null;
}

/** The member's own check: null when they aren't on Silver. */
export async function silverCheckStatus(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<SilverCheckStatus | null> {
  const [row] = await db
    .select({
      heldAt: memberSubscription.checkHeldAt,
      heldFor: memberSubscription.checkHoldReason,
      createdAt: user.createdAt,
      email: user.email,
      emailVerified: user.emailVerified,
      avatarKey: profile.avatarKey,
      coverKey: profile.coverKey,
    })
    .from(memberSubscription)
    .innerJoin(user, eq(user.id, memberSubscription.userId))
    .leftJoin(profile, eq(profile.userId, memberSubscription.userId))
    .where(and(eq(memberSubscription.userId, userId), gt(memberSubscription.currentPeriodEnd, now)))
    .limit(1);
  if (!row) return null;
  const showsFrom = new Date(row.createdAt.getTime() + CHECK_MIN_ACCOUNT_DAYS * 86_400_000);
  if (row.heldAt) return { shown: false, reason: "held", heldFor: row.heldFor, showsFrom: null };
  if (!row.avatarKey || !row.coverKey) {
    return { shown: false, reason: "photos", heldFor: null, showsFrom: null };
  }
  if (showsFrom > now && !isSuperAdmin(row)) {
    return { shown: false, reason: "new_account", heldFor: null, showsFrom };
  }
  return { shown: true, reason: null, heldFor: null, showsFrom: null };
}

/** When a member showing the check began their current run of Silver, or null without one. */
export async function silverSince(db: Db, userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ since: memberSubscription.startedAt })
    .from(memberSubscription)
    .where(and(eq(memberSubscription.userId, userId), silverCheck(memberSubscription.userId)))
    .limit(1);
  return row?.since ?? null;
}
