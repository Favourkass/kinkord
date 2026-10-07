import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { memberSubscription, type BillingPeriod } from "../db/schema";

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
