import { Inject, Injectable } from "@nestjs/common";
import { asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { DRIZZLE, type Db } from "../db/db.module";
import { kinkRing, profile, subscriptionPayment, user, type BillingPeriod } from "../db/schema";

/** Where a ring stands: still theirs to give, given away, or run out unused. */
export type AdminRingStatus = "unused" | "given" | "expired";

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
}

export interface MemberRings {
  counts: { total: number; unused: number; given: number; expired: number; received: number };
  batches: AdminRingBatch[];
  received: AdminReceivedRing[];
}

export function ringStatus(
  ring: { givenAt: Date | null; expiresAt: Date },
  now: Date,
): AdminRingStatus {
  if (ring.givenAt) return "given";
  return ring.expiresAt.getTime() <= now.getTime() ? "expired" : "unused";
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

/**
 * A member's Kink Rings as admins see them (Moderation → Members → member):
 * each payment's rings with where each one stands, when it runs out and who
 * it went to, and the rings others gave them.
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
        received: received.length,
      },
      batches: [...batches.values()],
      received: received.map((row) => ({
        id: row.id,
        givenAt: iso(row.givenAt),
        giver: { id: row.giverId, username: row.giverUsername, displayName: row.giverName },
        withNote: !!row.withNote,
      })),
    };
  }
}
