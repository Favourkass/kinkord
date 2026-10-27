import { eq } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { memberSubscription, type BillingPeriod, type SubscriptionPlan } from "../db/schema";
import { silverGiven } from "./given-silver";
import { addPeriod } from "./plans";

/** The client or an open transaction: both run the same queries. */
type Queryable = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * A period of Silver someone paid for, whether the member's own payment or a
 * Kink Ring given to them. It runs on from where their Silver ends, or from
 * now when it has run out. While Silver the founders gave is running, it goes
 * to the member's own time (`paidUntil`) instead, theirs if the gift is ever
 * taken back. Returns when their Silver ends now.
 *
 * `clearHeldCheck`: an admin confirming a payment is looking at the member as
 * they are now, so a check held after a name or photo change shows again. A
 * ring from another member vouches for nothing, so it leaves a hold alone.
 */
export async function addSilverTime(
  tx: Queryable,
  userId: string,
  plan: SubscriptionPlan,
  period: BillingPeriod,
  now: Date,
  { clearHeldCheck }: { clearHeldCheck: boolean },
): Promise<Date> {
  const [current] = await tx
    .select({
      end: memberSubscription.currentPeriodEnd,
      grantedBy: memberSubscription.grantedBy,
      paidUntil: memberSubscription.paidUntil,
    })
    .from(memberSubscription)
    .where(eq(memberSubscription.userId, userId))
    .for("update")
    .limit(1);
  const running = Boolean(current && current.end > now);
  if (current && running && silverGiven(current)) {
    const paid = current.paidUntil && current.paidUntil > now ? current.paidUntil : now;
    await tx
      .update(memberSubscription)
      .set({ paidUntil: addPeriod(paid, period), updatedAt: now })
      .where(eq(memberSubscription.userId, userId));
    return current.end;
  }
  const from = running && current ? current.end : now;
  const until = addPeriod(from, period);
  // A lapsed run starts over.
  await tx
    .insert(memberSubscription)
    .values({ userId, plan, currentPeriodEnd: until, startedAt: now })
    .onConflictDoUpdate({
      target: memberSubscription.userId,
      set: {
        plan,
        currentPeriodEnd: until,
        ...(clearHeldCheck ? { checkHeldAt: null, checkHoldReason: null } : {}),
        updatedAt: now,
        ...(running ? {} : { startedAt: now }),
      },
    });
  return until;
}
