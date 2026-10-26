import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { notification, profile, user, type NotificationType } from "../db/schema";
import { notificationUrl } from "./notifications.service";
import { digestBody, HOLD_EXPIRY_HOURS } from "./push-policy";
import { PushScheduleService } from "./push-schedule.service";
import { PushService, type PushMessage } from "./push.service";

const DIGEST_EVERY_MS = 5 * 60_000;
/** Held rows looked at per run, oldest first; the next run takes the rest. */
const BATCH = 1000;

interface HeldRow {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string | null;
  subjectId: string | null;
  createdAt: Date;
  readAt: Date | null;
}

/**
 * Sends held pushes when they're due (push/push-policy.ts): a bundle of likes,
 * reposts or follows once its two hours are up, and what waited through quiet
 * hours in the morning.
 */
@Injectable()
export class PushDigestService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PushDigestService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly push: PushService,
    private readonly schedule: PushScheduleService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(
      () =>
        void this.run().catch((e: unknown) => this.log.warn(`push digest failed: ${String(e)}`)),
      DIGEST_EVERY_MS,
    );
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Sends whatever is due and returns how many pushes went out. */
  async run(now = new Date()): Promise<number> {
    // Claim the oldest held rows in one statement, skipping any another instance
    // is claiming, so two instances running at once never push the same rows.
    const claimable = this.db
      .select({ id: notification.id })
      .from(notification)
      .where(eq(notification.pushPending, true))
      .orderBy(notification.createdAt)
      .limit(BATCH)
      .for("update", { skipLocked: true });
    const held: HeldRow[] = await this.db
      .update(notification)
      .set({ pushPending: false })
      .where(inArray(notification.id, claimable))
      .returning({
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        actorId: notification.actorId,
        subjectId: notification.subjectId,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
      });
    // What still has to wait goes back to being held.
    const holdAgain = (ids: string[]) =>
      ids.length
        ? this.db
            .update(notification)
            .set({ pushPending: true })
            .where(inArray(notification.id, ids))
        : Promise.resolve();

    const groups = new Map<string, HeldRow[]>();
    for (const row of held) {
      const key = `${row.userId}\u0000${row.type}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    let sent = 0;
    const expiry = now.getTime() - HOLD_EXPIRY_HOURS * 3_600_000;
    for (const rows of groups.values()) {
      const { userId, type } = rows[0];
      // Read in the app already, or too old to be worth a push: the inbox has it.
      const live = rows.filter((r) => !r.readAt && r.createdAt.getTime() > expiry);
      if (live.length === 0) continue;
      const decision = await this.schedule.decide(userId, type, now);
      if (decision === "hold") {
        await holdAgain(live.map((r) => r.id));
        continue;
      }
      if (decision === "send") {
        const delivered = await this.push.sendTo(userId, await this.message(type, live));
        if (delivered > 0) {
          await this.schedule.recordSent(userId, type);
          sent += 1;
        }
      }
    }
    return sent;
  }

  /** One push for a type's held rows: who (most recent first), never what. */
  async message(type: NotificationType, rows: HeldRow[]): Promise<PushMessage> {
    const newest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const actorIds = [...new Set(newest.map((r) => r.actorId).filter((id): id is string => !!id))];
    const names = await this.names(actorIds);
    const subjects = new Set(rows.map((r) => r.subjectId)).size;
    const only = rows.length === 1 ? rows[0] : null;
    return {
      title: "Kinkord",
      body: digestBody(
        type,
        actorIds.map((id) => names.get(id)?.name ?? "Someone"),
        rows.length,
        subjects,
      ),
      url: only
        ? notificationUrl(
            type,
            only.subjectId,
            only.actorId ? (names.get(only.actorId)?.username ?? null) : null,
          )
        : "/notifications",
      tag: `digest-${type}`,
      ...(only ? { notificationId: only.id } : {}),
    };
  }

  private async names(
    ids: string[],
  ): Promise<Map<string, { name: string; username: string | null }>> {
    if (!ids.length) return new Map();
    const rows = await this.db
      .select({
        id: user.id,
        username: user.username,
        name: user.name,
        displayName: profile.displayName,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(inArray(user.id, ids));
    return new Map(
      rows.map((r) => [
        r.id,
        { name: r.displayName ?? r.username ?? r.name ?? "Someone", username: r.username },
      ]),
    );
  }
}
