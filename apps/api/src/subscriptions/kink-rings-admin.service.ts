import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  kinkRing,
  memberSubscription,
  moderationLog,
  profile,
  subscriptionPayment,
  user,
  type BillingPeriod,
} from "../db/schema";
import { silverGiven } from "./given-silver";
import { MAX_RINGS } from "./kink-rings";
import { addMonths } from "./plans";
import { ringsPerPlan, saveRingsPerPlan, type RingsPerPlan } from "./ring-settings";
import { silverFrom } from "./silver-time";

/** The client or an open transaction: both run the same queries. */
type Queryable = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Where a ring stands: still theirs to give, given away, run out unused, or
 * taken back by an admin before it was given.
 */
export type AdminRingStatus = "unused" | "given" | "expired" | "cancelled";

export interface AdminRingPerson {
  id: string;
  username: string | null;
  displayName: string | null;
}

export interface AdminRing {
  id: string;
  /** Its place among the payment's rings, 1 to 12. */
  seq: number;
  status: AdminRingStatus;
  expiresAt: string;
  givenAt: string | null;
  /** Null when it hasn't been given, or the receiver has since deleted their account. */
  recipient: AdminRingPerson | null;
  /** Given to someone whose account has since gone. */
  recipientLeft: boolean;
  /** Whether a note went with it. The note itself stays between the two members. */
  withNote: boolean;
  /** An admin took back the month of Silver it gave. */
  silverCancelled: boolean;
}

/** The rings one Silver payment brought, or the ones Kinkord gave (no payment). */
export interface AdminRingBatch {
  paymentId: string | null;
  period: BillingPeriod | null;
  /** When the payment was confirmed, which is when its rings started counting down. */
  confirmedAt: string | null;
  rings: AdminRing[];
}

export interface AdminReceivedRing {
  id: string;
  givenAt: string | null;
  giver: AdminRingPerson;
  withNote: boolean;
  silverCancelled: boolean;
}

export interface MemberRings {
  counts: {
    total: number;
    /** Their balance: rings they can still give. */
    unused: number;
    given: number;
    expired: number;
    cancelled: number;
    received: number;
  };
  batches: AdminRingBatch[];
  received: AdminReceivedRing[];
}

export function ringStatus(
  ring: { givenAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): AdminRingStatus {
  if (ring.givenAt) return "given";
  if (ring.revokedAt) return "cancelled";
  return ring.expiresAt.getTime() <= now.getTime() ? "expired" : "unused";
}

/**
 * Where a member's own Silver time ends once a ring's month is taken back: a
 * month sooner, but never sooner than their payments and their other rings
 * carry it (`floor`), so paid time stays theirs. Null when nothing is left.
 */
export function withoutRingMonth(own: Date, floor: Date | null, now: Date): Date | null {
  const monthLess = addMonths(own, -1);
  const until = floor && floor > monthLess ? (floor < own ? floor : own) : monthLess;
  return until > now ? until : null;
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

/**
 * A member's Kink Rings as admins see them (Moderation → Members → member):
 * each payment's rings with where each one stands, when it runs out and who
 * it went to, and the rings others gave them. Admins can take back the rings
 * a member still has, or the Silver a ring gave; nothing is deleted.
 */
@Injectable()
export class KinkRingsAdminService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async forMember(userId: string, now = new Date()): Promise<MemberRings> {
    const recipient = alias(user, "ring_recipient");
    const recipientProfile = alias(profile, "ring_recipient_profile");
    const giver = alias(user, "ring_giver");
    const giverProfile = alias(profile, "ring_giver_profile");
    const [own, received] = await Promise.all([
      this.db
        .select({
          id: kinkRing.id,
          seq: kinkRing.seq,
          expiresAt: kinkRing.expiresAt,
          givenAt: kinkRing.givenAt,
          givenTo: kinkRing.givenTo,
          revokedAt: kinkRing.revokedAt,
          silverCancelledAt: kinkRing.usageCancelledAt,
          withNote: sql<boolean>`${kinkRing.giftMessage} is not null`,
          createdAt: kinkRing.createdAt,
          paymentId: kinkRing.paymentId,
          period: subscriptionPayment.period,
          confirmedAt: subscriptionPayment.reviewedAt,
          recipientUsername: recipient.username,
          recipientName: recipientProfile.displayName,
        })
        .from(kinkRing)
        .leftJoin(subscriptionPayment, eq(subscriptionPayment.id, kinkRing.paymentId))
        .leftJoin(recipient, eq(recipient.id, kinkRing.givenTo))
        .leftJoin(recipientProfile, eq(recipientProfile.userId, kinkRing.givenTo))
        .where(eq(kinkRing.ownerId, userId))
        .orderBy(desc(kinkRing.createdAt), asc(kinkRing.seq)),
      this.db
        .select({
          id: kinkRing.id,
          givenAt: kinkRing.givenAt,
          silverCancelledAt: kinkRing.usageCancelledAt,
          withNote: sql<boolean>`${kinkRing.giftMessage} is not null`,
          giverId: kinkRing.ownerId,
          giverUsername: giver.username,
          giverName: giverProfile.displayName,
        })
        .from(kinkRing)
        .innerJoin(giver, eq(giver.id, kinkRing.ownerId))
        .leftJoin(giverProfile, eq(giverProfile.userId, kinkRing.ownerId))
        .where(eq(kinkRing.givenTo, userId))
        .orderBy(desc(kinkRing.givenAt)),
    ]);

    // Newest payment first; within it, the rings in the order they run out.
    const batches = new Map<string, AdminRingBatch>();
    for (const row of own) {
      const key = row.paymentId ?? "kinkord";
      let batch = batches.get(key);
      if (!batch) {
        batch = {
          paymentId: row.paymentId,
          period: row.period,
          confirmedAt: iso(row.confirmedAt),
          rings: [],
        };
        batches.set(key, batch);
      }
      batch.rings.push({
        id: row.id,
        seq: row.seq,
        status: ringStatus(row, now),
        expiresAt: row.expiresAt.toISOString(),
        givenAt: iso(row.givenAt),
        recipient: row.givenTo
          ? { id: row.givenTo, username: row.recipientUsername, displayName: row.recipientName }
          : null,
        recipientLeft: !!row.givenAt && !row.givenTo,
        withNote: !!row.withNote,
        silverCancelled: !!row.silverCancelledAt,
      });
    }
    // Rings 1 to 12 in order, whatever order they were written in.
    for (const batch of batches.values()) batch.rings.sort((a, b) => a.seq - b.seq);
    const rings = [...batches.values()].flatMap((batch) => batch.rings);
    const count = (status: AdminRingStatus) => rings.filter((r) => r.status === status).length;
    return {
      counts: {
        total: rings.length,
        unused: count("unused"),
        given: count("given"),
        expired: count("expired"),
        cancelled: count("cancelled"),
        received: received.length,
      },
      batches: [...batches.values()],
      received: received.map((row) => ({
        id: row.id,
        givenAt: iso(row.givenAt),
        giver: { id: row.giverId, username: row.giverUsername, displayName: row.giverName },
        withNote: !!row.withNote,
        silverCancelled: !!row.silverCancelledAt,
      })),
    };
  }

  /** How many rings each plan brings; only the founders may change it. */
  async settings(
    canEdit: boolean,
  ): Promise<{ rings: RingsPerPlan; canEdit: boolean; max: number }> {
    return { rings: await ringsPerPlan(this.db), canEdit, max: MAX_RINGS };
  }

  async saveSettings(actorId: string, rings: RingsPerPlan) {
    await this.db.transaction(async (tx) => {
      await saveRingsPerPlan(tx, rings, actorId);
      await tx.insert(moderationLog).values({
        actorId,
        action: "set-kink-rings",
        detail: `monthly ${rings.monthly}, yearly ${rings.yearly}`,
      });
    });
    return this.settings(true);
  }

  /**
   * Takes back every ring the member still has to give, so their balance is
   * zero. Rings already given, and the Silver those gave, stay as they are.
   */
  async cancelUnused(userId: string, actorId: string, reason: string, now = new Date()) {
    return this.db.transaction(async (tx) => {
      const cancelled = await tx
        .update(kinkRing)
        .set({ revokedAt: now, revokedBy: actorId, revokeReason: reason })
        .where(
          and(
            eq(kinkRing.ownerId, userId),
            isNull(kinkRing.givenAt),
            isNull(kinkRing.revokedAt),
            gt(kinkRing.expiresAt, now),
          ),
        )
        .returning({ id: kinkRing.id });
      if (!cancelled.length) throw new ConflictException("They have no unused Kink Rings.");
      await tx.insert(moderationLog).values({
        actorId,
        action: "cancel-kink-rings",
        subjectUserId: userId,
        detail: `${cancelled.length} ring${cancelled.length === 1 ? "" : "s"}: ${reason}`,
      });
      return { cancelled: cancelled.length };
    });
  }

  /**
   * Takes back the month of Silver a ring gave its receiver. A member whose
   * only Silver was that month is on Basic from now. The ring stays given.
   */
  async cancelSilver(ringId: string, actorId: string, reason: string, now = new Date()) {
    return this.db.transaction(async (tx) => {
      const [ring] = await tx
        .select({
          givenTo: kinkRing.givenTo,
          givenAt: kinkRing.givenAt,
          silverCancelledAt: kinkRing.usageCancelledAt,
        })
        .from(kinkRing)
        .where(eq(kinkRing.id, ringId))
        .for("update")
        .limit(1);
      if (!ring?.givenAt) throw new NotFoundException("That ring hasn't been given.");
      if (!ring.givenTo) throw new ConflictException("Whoever got that ring has left Kinkord.");
      if (ring.silverCancelledAt) {
        throw new ConflictException("The Silver from that ring was already cancelled.");
      }
      const memberId = ring.givenTo;
      // Gifts to the member wait for this, as they wait for each other.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"kink-ring:"} || ${memberId}, 0))`,
      );
      await tx
        .update(kinkRing)
        .set({ usageCancelledAt: now, usageCancelledBy: actorId, usageCancelReason: reason })
        .where(eq(kinkRing.id, ringId));
      const silverUntil = await takeRingMonth(tx, memberId, now);
      await tx.insert(moderationLog).values({
        actorId,
        action: "cancel-kink-ring-silver",
        subjectUserId: memberId,
        detail: reason,
      });
      return { memberId, silverUntil: iso(silverUntil) };
    });
  }
}

/**
 * Takes a ring's month off the member's Silver, once the ring is marked. While
 * the founders' Silver runs, it comes off the time set aside for them instead.
 * Returns when their Silver ends now, null when they're on Basic.
 */
async function takeRingMonth(tx: Queryable, userId: string, now: Date): Promise<Date | null> {
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
  // Silver that has run out has spent the ring's month already.
  if (!current || current.end <= now) return null;
  const given = silverGiven(current);
  const own = given ? current.paidUntil : current.end;
  if (!own || own <= now) return given ? current.end : null;
  const [payments, rings] = await Promise.all([
    tx
      .select({ at: subscriptionPayment.reviewedAt, period: subscriptionPayment.period })
      .from(subscriptionPayment)
      .where(
        and(
          eq(subscriptionPayment.userId, userId),
          eq(subscriptionPayment.status, "verified"),
          isNotNull(subscriptionPayment.reviewedAt),
        ),
      ),
    tx
      .select({ at: kinkRing.givenAt })
      .from(kinkRing)
      .where(and(eq(kinkRing.givenTo, userId), isNull(kinkRing.usageCancelledAt))),
  ]);
  const floor = silverFrom([
    ...payments.map((p) => ({ at: p.at!, period: p.period })),
    ...rings.filter((r) => r.at).map((r) => ({ at: r.at!, period: "monthly" as const })),
  ]);
  const until = withoutRingMonth(own, floor, now);
  if (given) {
    await tx
      .update(memberSubscription)
      .set({ paidUntil: until, updatedAt: now })
      .where(eq(memberSubscription.userId, userId));
    return current.end;
  }
  await tx
    .update(memberSubscription)
    .set({ currentPeriodEnd: until ?? now, updatedAt: now })
    .where(eq(memberSubscription.userId, userId));
  return until;
}
