import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, inArray, lt, max, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { profile, pushPreference, pushSent, user, type NotificationType } from "../db/schema";
import { BUNDLED_TYPES, decidePush, timeZoneOf, type PushDecision } from "./push-policy";

/** What decides a push for one member. */
export interface PushState {
  off: ReadonlySet<string>;
  timeZone: string;
  lastSentOfType: Date | null;
  bundledSentToday: number;
}

/** Applies push-policy.ts to a member, from what the database knows about them. */
@Injectable()
export class PushScheduleService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async state(userId: string, type: NotificationType): Promise<PushState> {
    const [member] = await this.db
      .select({ off: pushPreference.off, country: profile.country, state: profile.state })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .leftJoin(pushPreference, eq(pushPreference.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    const [last] = await this.db
      .select({ at: max(pushSent.sentAt) })
      .from(pushSent)
      .where(and(eq(pushSent.userId, userId), eq(pushSent.type, type)));
    const [today] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(pushSent)
      .where(
        and(
          eq(pushSent.userId, userId),
          inArray(pushSent.type, [...BUNDLED_TYPES]),
          gt(pushSent.sentAt, sql`now() - interval '24 hours'`),
        ),
      );
    return {
      off: new Set(member?.off ?? []),
      timeZone: timeZoneOf(member?.country ?? null, member?.state ?? null),
      lastSentOfType: last?.at ?? null,
      bundledSentToday: today?.n ?? 0,
    };
  }

  async decide(userId: string, type: NotificationType, now = new Date()): Promise<PushDecision> {
    return decidePush({ type, now, ...(await this.state(userId, type)) });
  }

  /** A push reached the member's devices: it counts towards spacing and the daily cap. */
  async recordSent(userId: string, type: NotificationType): Promise<void> {
    await this.db.insert(pushSent).values({ userId, type });
    // Only the last day matters; clear older rows now and then instead of on a timer.
    if (Math.random() < 0.05) {
      await this.db.delete(pushSent).where(lt(pushSent.sentAt, sql`now() - interval '2 days'`));
    }
  }
}
