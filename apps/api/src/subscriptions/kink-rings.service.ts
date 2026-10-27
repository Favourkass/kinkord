import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, count, desc, eq, gt, isNotNull, isNull, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { DRIZZLE, type Db } from "../db/db.module";
import { kinkRing, profile, user } from "../db/schema";
import { notBanned } from "../moderation/admins";
import { PushService } from "../push/push.service";
import { noBlockEitherWay } from "../safety/blocks";
import { silverForGood, silverUntil } from "./plans";
import { addSilverTime } from "./silver-time";

/** How many of the rings the member gave their list shows, newest first. */
const GIVEN_SHOWN = 20;

export const giveRingSchema = z.object({ username: z.string().trim().min(1).max(64) }).strict();

export interface KinkRingsDto {
  /** The rings the member can give, soonest to expire first. */
  available: Array<{ id: string; expiresAt: string }>;
  /** The last rings they gave, newest first; `to` is null once that member has left. */
  given: Array<{
    id: string;
    givenAt: string;
    to: { username: string | null; displayName: string } | null;
  }>;
}

export interface GiveRingDto {
  ringId: string;
  to: { username: string | null; displayName: string };
  /** The rings the member has left to give. */
  left: number;
}

/**
 * Kink Rings, the member's side (docs/KINK_RINGS.md): the rings they hold, and
 * giving one away, which puts the receiver on Silver for a month.
 */
@Injectable()
export class KinkRingsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly push: PushService,
  ) {}

  async mine(userId: string, now = new Date()): Promise<KinkRingsDto> {
    const receiver = alias(profile, "ring_receiver");
    const [available, given] = await Promise.all([
      this.db
        .select({ id: kinkRing.id, expiresAt: kinkRing.expiresAt })
        .from(kinkRing)
        .where(and(...unspent(userId, now)))
        .orderBy(asc(kinkRing.expiresAt), asc(kinkRing.id)),
      this.db
        .select({
          id: kinkRing.id,
          givenAt: kinkRing.givenAt,
          username: user.username,
          displayName: receiver.displayName,
        })
        .from(kinkRing)
        .leftJoin(user, eq(user.id, kinkRing.givenTo))
        .leftJoin(receiver, eq(receiver.userId, kinkRing.givenTo))
        .where(and(eq(kinkRing.ownerId, userId), isNotNull(kinkRing.givenAt)))
        .orderBy(desc(kinkRing.givenAt))
        .limit(GIVEN_SHOWN),
    ]);
    return {
      available: available.map((r) => ({ id: r.id, expiresAt: r.expiresAt.toISOString() })),
      given: given.map((r) => ({
        id: r.id,
        givenAt: (r.givenAt as Date).toISOString(),
        to:
          r.username || r.displayName
            ? { username: r.username, displayName: r.displayName ?? r.username ?? "Member" }
            : null,
      })),
    };
  }

  /**
   * Gives the member's soonest-to-expire ring to someone else: a month of
   * Silver for them, on from wherever theirs ends. Never to themselves, an
   * organization, a suspended member, anyone on either side of a block, or
   * someone whose Silver already runs for good.
   */
  async give(giverId: string, username: string, now = new Date()): Promise<GiveRingDto> {
    const handle = username.trim().replace(/^@/, "").toLowerCase();
    const [to] = await this.db
      .select({
        id: user.id,
        username: user.username,
        displayName: profile.displayName,
        accountType: profile.accountType,
      })
      .from(user)
      .innerJoin(profile, eq(profile.userId, user.id))
      .where(and(eq(user.username, handle), notBanned(user.id), noBlockEitherWay(user.id, giverId)))
      .limit(1);
    if (!to) throw new NotFoundException("There's no member with that username.");
    if (to.id === giverId) {
      throw new BadRequestException("Kink Rings are for giving: choose someone else.");
    }
    if (to.accountType === "organization") {
      throw new BadRequestException("Kink Rings are for members, not organizations.");
    }
    if (silverForGood(await silverUntil(this.db, to.id))) {
      throw new BadRequestException(`${to.displayName} already has Silver for good.`);
    }
    const ringId = await this.db.transaction(async (tx) => {
      const [ring] = await tx
        .select({ id: kinkRing.id })
        .from(kinkRing)
        .where(and(...unspent(giverId, now)))
        .orderBy(asc(kinkRing.expiresAt), asc(kinkRing.id))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!ring) throw new ConflictException("You have no Kink Rings left to give.");
      await tx
        .update(kinkRing)
        .set({ givenTo: to.id, givenAt: now })
        .where(eq(kinkRing.id, ring.id));
      await addSilverTime(tx, to.id, "silver", "monthly", now, { clearHeldCheck: false });
      return ring.id;
    });
    this.push.kinkRingGiven(giverId, to.id, ringId);
    const [left] = await this.db
      .select({ n: count() })
      .from(kinkRing)
      .where(and(...unspent(giverId, now)));
    return {
      ringId,
      to: { username: to.username, displayName: to.displayName },
      left: Number(left?.n ?? 0),
    };
  }
}

/** The member's rings not given yet and not expired. */
function unspent(ownerId: string, now: Date): SQL[] {
  return [eq(kinkRing.ownerId, ownerId), isNull(kinkRing.givenAt), gt(kinkRing.expiresAt, now)];
}
