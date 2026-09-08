import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";

/** A member is "online" if they made an authenticated request this recently. */
export const ONLINE_WINDOW_SECONDS = 300;
/** Never rewrite last_seen_at more often than this — keeps the auth hot path cheap. */
export const TOUCH_INTERVAL_SECONDS = 60;

/**
 * Lightweight presence: a throttled `last_seen_at` heartbeat written as a side
 * effect of authenticated traffic. Good enough for online dots and "Last seen an
 * hour ago" without sockets; swap the write path for a real-time channel later.
 */
@Injectable()
export class PresenceService {
  private readonly log = new Logger(PresenceService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * Fire-and-forget heartbeat. Raw SQL on purpose: Drizzle's `.update()` would also
   * bump `updated_at` via $onUpdate, and presence must not masquerade as an edit.
   * The interval guard makes it a no-op when the row was touched recently.
   */
  touch(userId: string): void {
    void this.db
      .execute(
        sql`update "profile"
              set "last_seen_at" = now()
            where "user_id" = ${userId}
              and ("last_seen_at" is null
                   or "last_seen_at" < now() - (${sql.raw(String(TOUCH_INTERVAL_SECONDS))} * interval '1 second'))`,
      )
      .catch((e: unknown) => this.log.warn(`presence touch failed: ${String(e)}`));
  }

  static isOnline(lastSeenAt: Date | null | undefined, now = new Date()): boolean {
    if (!lastSeenAt) return false;
    return now.getTime() - lastSeenAt.getTime() < ONLINE_WINDOW_SECONDS * 1000;
  }
}
