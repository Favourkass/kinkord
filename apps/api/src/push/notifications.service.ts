import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { DRIZZLE, type Db } from "../db/db.module";
import { StorageService } from "../storage/storage.service";
import { notification, type NotificationType } from "../db/schema";

export interface InboxMessage {
  type: NotificationType;
  title: string;
  body: string;
  url: string;
  actor?: { name: string; avatarKey: string | null };
}

const cursorSchema = z.object({ at: z.string().datetime(), id: z.string().uuid() });
const PAGE_SIZE = 20;

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  async create(userId: string, message: InboxMessage): Promise<string> {
    const [row] = await this.db
      .insert(notification)
      .values({ userId, ...message })
      .returning({ id: notification.id });
    return row.id;
  }

  async list(userId: string, cursor?: string, unreadOnly = false, type?: "comment" | "mention") {
    let before: z.infer<typeof cursorSchema> | undefined;
    if (cursor) {
      try {
        before = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
      } catch {
        throw new BadRequestException("Invalid notification cursor.");
      }
    }
    const rows = await this.db
      .select()
      .from(notification)
      .where(
        and(
          eq(notification.userId, userId),
          ...(type ? [eq(notification.type, type)] : []),
          ...(unreadOnly ? [isNull(notification.readAt)] : []),
          ...(before
            ? [
                or(
                  lt(notification.createdAt, new Date(before.at)),
                  and(
                    eq(notification.createdAt, new Date(before.at)),
                    lt(notification.id, before.id),
                  ),
                ),
              ]
            : []),
        ),
      )
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(PAGE_SIZE + 1);
    const items = await Promise.all(rows.slice(0, PAGE_SIZE).map((row) => this.toItem(row)));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > PAGE_SIZE && last
          ? Buffer.from(JSON.stringify({ at: last.createdAt, id: last.id })).toString("base64url")
          : null,
    };
  }

  async unreadCount(userId: string) {
    const [row] = await this.db
      .select({ total: count() })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
    return { count: Number(row?.total ?? 0) };
  }

  /** Ownership is part of every query; another member's id is never readable. */
  async read(userId: string, id: string) {
    const [updated] = await this.db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(eq(notification.id, id), eq(notification.userId, userId), isNull(notification.readAt)),
      )
      .returning();
    if (updated) return this.toItem(updated);
    // Repeated opens preserve the original read time.
    const [existing] = await this.db
      .select()
      .from(notification)
      .where(and(eq(notification.id, id), eq(notification.userId, userId)))
      .limit(1);
    if (!existing) throw new NotFoundException("Notification not found.");
    return this.toItem(existing);
  }

  async readAll(userId: string) {
    await this.db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
    return { ok: true };
  }

  private async toItem(row: typeof notification.$inferSelect) {
    return {
      actor: row.actor
        ? {
            name: row.actor.name,
            avatarUrl: row.actor.avatarKey
              ? await this.storage.presignDownload(row.actor.avatarKey, "sm")
              : null,
          }
        : null,
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      url: row.url,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    };
  }
}
