import { eq } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { memberSubscription } from "../db/schema";
import { FOUNDER_SILVER_UNTIL, silverForGood } from "./plans";

/** The client or an open transaction: both run the same queries. */
type Queryable = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Silver the founders gave rather than Silver paid for: what they can take
 * back. Silver for good with no giver recorded came from the founders too,
 * set by hand before there was a button for it. A founder's own Silver also
 * runs for good, so callers rule the founders out first.
 */
export function silverGiven(row: { end: Date; grantedBy: string | null }): boolean {
  return Boolean(row.grantedBy) || silverForGood(row.end);
}

/**
 * Puts an admin on Silver for good, as the founders are. Paid time they still
 * had is set aside in `paidUntil`, theirs again if the gift is taken back. A
 * check held after a name or photo change shows again: the founders are
 * vouching for them. False when they already had Silver from the founders.
 */
export async function giveSilver(
  db: Queryable,
  userId: string,
  givenBy: string,
  now = new Date(),
): Promise<boolean> {
  const [current] = await db
    .select({ end: memberSubscription.currentPeriodEnd, grantedBy: memberSubscription.grantedBy })
    .from(memberSubscription)
    .where(eq(memberSubscription.userId, userId))
    .for("update")
    .limit(1);
  const running = current && current.end > now ? current : null;
  if (running && silverGiven(running)) return false;
  await db
    .insert(memberSubscription)
    .values({
      userId,
      plan: "silver",
      currentPeriodEnd: FOUNDER_SILVER_UNTIL,
      grantedBy: givenBy,
      startedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: memberSubscription.userId,
      set: {
        plan: "silver",
        currentPeriodEnd: FOUNDER_SILVER_UNTIL,
        grantedBy: givenBy,
        paidUntil: running?.end ?? null,
        checkHeldAt: null,
        checkHoldReason: null,
        updatedAt: now,
        // An admin already on Silver keeps the date it began.
        ...(running ? {} : { startedAt: now }),
      },
    });
  return true;
}

/**
 * Ends the Silver the founders gave. Paid time the admin had set aside comes
 * back; without any left, they're on Basic from now. False when there was no
 * given Silver to take.
 */
export async function takeBackSilver(
  db: Queryable,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  const [current] = await db
    .select({
      end: memberSubscription.currentPeriodEnd,
      grantedBy: memberSubscription.grantedBy,
      paidUntil: memberSubscription.paidUntil,
    })
    .from(memberSubscription)
    .where(eq(memberSubscription.userId, userId))
    .for("update")
    .limit(1);
  if (!current || current.end <= now || !silverGiven(current)) return false;
  const paid = current.paidUntil && current.paidUntil > now ? current.paidUntil : null;
  await db
    .update(memberSubscription)
    .set({ currentPeriodEnd: paid ?? now, grantedBy: null, paidUntil: null, updatedAt: now })
    .where(eq(memberSubscription.userId, userId));
  return true;
}
