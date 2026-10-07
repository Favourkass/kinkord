import { ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  memberSubscription,
  moderationLog,
  profile,
  user,
  type SilverCheckHold,
} from "../db/schema";
import { notBanned } from "../moderation/admins";
import { PushService } from "../push/push.service";
import { StorageService } from "../storage/storage.service";
import { silverCheckStatus } from "./plans";

const LIST_LIMIT = 100;

export interface HeldCheckDto {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** What changed, or "admin" when an admin took the check away. */
  reason: SilverCheckHold | null;
  heldAt: string;
  silverUntil: string;
}

export interface MemberCheckDto {
  silverUntil: string;
  shown: boolean;
  reason: "held" | "new_account" | "photos" | null;
  heldFor: SilverCheckHold | null;
  showsFrom: string | null;
}

/**
 * The Silver check, X-style: it comes with Silver, but a member who changes
 * their name, username or photo loses it until an admin has looked, so a
 * check can't be bought and then used to pass as someone else.
 */
@Injectable()
export class SilverChecksService {
  private readonly log = new Logger(SilverChecksService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly push: PushService,
  ) {}

  /**
   * A Silver member changed how they appear: the check hides until an admin
   * approves it, and the admins hear of it. Nothing happens for a member
   * without Silver. Never fails the change that caused it.
   */
  async hold(userId: string, reason: Exclude<SilverCheckHold, "admin">): Promise<boolean> {
    try {
      const held = await this.db
        .update(memberSubscription)
        .set({ checkHeldAt: new Date(), checkHoldReason: reason })
        .where(
          and(
            eq(memberSubscription.userId, userId),
            gt(memberSubscription.currentPeriodEnd, sql`now()`),
          ),
        )
        .returning({ userId: memberSubscription.userId });
      if (!held.length) return false;
      this.push.silverCheckReview();
      return true;
    } catch (e) {
      this.log.warn(`holding a Silver check failed: ${String(e)}`);
      return false;
    }
  }

  /** Silver members whose check waits for a look, longest waiting first. */
  async held(): Promise<HeldCheckDto[]> {
    const rows = await this.db
      .select({
        userId: memberSubscription.userId,
        heldAt: memberSubscription.checkHeldAt,
        reason: memberSubscription.checkHoldReason,
        until: memberSubscription.currentPeriodEnd,
        username: user.username,
        name: user.name,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
      })
      .from(memberSubscription)
      .innerJoin(user, eq(user.id, memberSubscription.userId))
      .leftJoin(profile, eq(profile.userId, memberSubscription.userId))
      .where(
        and(
          isNotNull(memberSubscription.checkHeldAt),
          gt(memberSubscription.currentPeriodEnd, sql`now()`),
          notBanned(memberSubscription.userId),
        ),
      )
      .orderBy(asc(memberSubscription.checkHeldAt))
      .limit(LIST_LIMIT);
    return Promise.all(
      rows.map(async (r) => ({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName ?? r.username ?? r.name,
        avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "sm") : null,
        reason: r.reason,
        heldAt: (r.heldAt as Date).toISOString(),
        silverUntil: r.until.toISOString(),
      })),
    );
  }

  /** One member's check, for their page in the admin area: null when they aren't on Silver. */
  async forMember(userId: string): Promise<MemberCheckDto | null> {
    const [sub] = await this.db
      .select({ until: memberSubscription.currentPeriodEnd })
      .from(memberSubscription)
      .where(
        and(
          eq(memberSubscription.userId, userId),
          gt(memberSubscription.currentPeriodEnd, sql`now()`),
        ),
      )
      .limit(1);
    const status = sub ? await silverCheckStatus(this.db, userId) : null;
    if (!sub || !status) return null;
    return {
      silverUntil: sub.until.toISOString(),
      shown: status.shown,
      reason: status.reason,
      heldFor: status.heldFor,
      showsFrom: status.showsFrom?.toISOString() ?? null,
    };
  }

  /** An admin has looked at the member as they are now: the check shows again. */
  async approve(actorId: string, userId: string): Promise<{ userId: string }> {
    const [row] = await this.db
      .update(memberSubscription)
      .set({ checkHeldAt: null, checkHoldReason: null })
      .where(and(eq(memberSubscription.userId, userId), isNotNull(memberSubscription.checkHeldAt)))
      .returning({ userId: memberSubscription.userId });
    if (!row) throw new ConflictException("This member's badge isn't waiting for review.");
    await this.db.insert(moderationLog).values({
      actorId,
      action: "silver_check_approved",
      subjectUserId: userId,
    });
    return { userId };
  }

  /** An admin takes the check away (an impersonation report, say) until they approve it again. */
  async remove(
    actorId: string,
    userId: string,
    reason?: string | null,
  ): Promise<{ userId: string }> {
    const [row] = await this.db
      .update(memberSubscription)
      .set({ checkHeldAt: new Date(), checkHoldReason: "admin" })
      .where(
        and(
          eq(memberSubscription.userId, userId),
          gt(memberSubscription.currentPeriodEnd, sql`now()`),
        ),
      )
      .returning({ userId: memberSubscription.userId });
    if (!row) throw new NotFoundException("This member isn't on Silver.");
    await this.db.insert(moderationLog).values({
      actorId,
      action: "silver_check_removed",
      subjectUserId: userId,
      detail: reason || null,
    });
    return { userId };
  }
}
