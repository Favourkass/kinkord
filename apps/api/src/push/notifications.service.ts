import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { DRIZZLE, type Db } from "../db/db.module";
import { memberBlock, notification, profile, user, type NotificationType } from "../db/schema";
import { notBanned } from "../moderation/admins";
import { RealtimeService } from "../realtime/realtime.service";
import { blockedBy } from "../safety/blocks";
import { StorageService } from "../storage/storage.service";
import { silverCheck } from "../subscriptions/plans";

/** Something that happened, as the code that saw it describes it. */
export interface InboxEvent {
  type: NotificationType;
  /** Who did it; none for Kinkord's own (reports, the push test). */
  actorId?: string;
  /** The post, or the conversation for a message. */
  subjectId?: string;
  /** When it happened: a message's own time, so reading up to it clears its row. */
  at?: Date;
}

export interface InboxItem {
  id: string;
  type: NotificationType;
  actor: {
    name: string;
    username: string | null;
    avatarUrl: string | null;
    /** Shows the Silver check beside their name. */
    silver: boolean;
  } | null;
  url: string;
  /** Messages in a chat since its row was last read; 1 otherwise. */
  count: number;
  createdAt: string;
  readAt: string | null;
}

/** A row as the inbox reads it, with who did it as they are now. */
interface InboxRow {
  id: string;
  type: NotificationType;
  actorId: string | null;
  subjectId: string | null;
  count: number;
  createdAt: Date;
  readAt: Date | null;
  actorUsername: string | null;
  actorName: string | null;
  actorDisplayName: string | null;
  actorAvatarKey: string | null;
  actorSilver: boolean | null;
}

export interface InboxQuery {
  cursor?: string;
  unreadOnly?: boolean;
  type?: "comment" | "mention";
  /** Matches who did it, or a word for the kind of activity ("liked", "follow"). */
  q?: string;
}

/** Read notifications older than this are deleted. */
export const RETENTION_DAYS = 90;
/** Each member's old rows are swept at most this often per API instance. */
const SWEEP_EVERY_MS = 6 * 60 * 60_000;
const PAGE_SIZE = 20;

/**
 * How a type repeats. "skip": the same person doing the same thing to the same
 * post again (unlike then like, unfollow then follow) tells nobody twice, until
 * the old row has been read and swept. "bump": another message in a chat, or a
 * new push test, moves the existing row back to the top as unread.
 */
const REPEATS: Partial<
  Record<NotificationType, { key: (e: InboxEvent) => string; on: "skip" | "bump" }>
> = {
  like: { key: (e) => `like:${e.actorId}:${e.subjectId}`, on: "skip" },
  repost: { key: (e) => `repost:${e.actorId}:${e.subjectId}`, on: "skip" },
  follow: { key: (e) => `follow:${e.actorId}`, on: "skip" },
  message: { key: (e) => `message:${e.subjectId}`, on: "bump" },
  test: { key: () => "test", on: "bump" },
};

/** Words a search can use to find a kind of notification, besides names. */
const SEARCH_WORDS: Record<NotificationType, readonly string[]> = {
  message: ["message", "messages", "chat"],
  follow: ["follow", "followed", "follower", "followers"],
  comment: ["comment", "commented", "comments"],
  mention: ["mention", "mentioned", "mentions"],
  like: ["like", "liked", "likes"],
  repost: ["repost", "reposted", "reposts"],
  report: ["report", "reports", "moderation"],
  verification: ["verification", "verify", "moderation"],
  test: ["notifications", "enabled"],
  payment: ["payment", "payments", "verify"],
  payment_verified: ["payment", "silver", "premium", "subscription"],
  payment_rejected: ["payment", "silver", "premium", "subscription"],
  silver_check: ["silver", "check", "review"],
};

const cursorSchema = z.object({ at: z.string().datetime(), id: z.string().uuid() });

/** Where tapping a notification goes, worked out when it's shown so a changed username still lands. */
export function notificationUrl(
  type: NotificationType,
  subjectId: string | null,
  actorUsername: string | null,
): string {
  switch (type) {
    case "message":
      return subjectId ? `/messages/${subjectId}` : "/messages";
    case "follow":
      return actorUsername ? `/u/${encodeURIComponent(actorUsername)}` : "/notifications";
    case "report":
      return "/moderation/reports";
    case "payment":
    case "silver_check":
      return "/moderation/payments";
    case "payment_verified":
    case "payment_rejected":
      return "/subscription";
    case "verification":
      return "/moderation/verification";
    case "test":
      return "/settings";
    default:
      return subjectId ? `/p/${subjectId}` : "/notifications";
  }
}

/** The kinds of notification a search term names, by the start of any of their words. */
export function typesMatching(term: string): NotificationType[] {
  const t = term.trim().toLowerCase();
  if (t.length < 2) return [];
  return (Object.keys(SEARCH_WORDS) as NotificationType[]).filter((type) =>
    SEARCH_WORDS[type].some((word) => word.startsWith(t)),
  );
}

/** A LIKE pattern that finds `term` anywhere, with its own % and _ taken literally. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private readonly swept = new Map<string, number>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Stores an event for its recipient and tells their open apps. Returns the
   * row's id, or null when nothing new was stored: their own doing, a member
   * they've blocked, or a repeat of something they've already been told.
   */
  async record(recipientId: string, event: InboxEvent): Promise<string | null> {
    if (event.actorId === recipientId) return null;
    if (event.actorId && (await this.hasBlocked(recipientId, event.actorId))) return null;
    const repeat = REPEATS[event.type];
    const insert = this.db.insert(notification).values({
      userId: recipientId,
      type: event.type,
      actorId: event.actorId ?? null,
      subjectId: event.subjectId ?? null,
      dedupeKey: repeat?.key(event) ?? null,
      ...(event.at ? { createdAt: event.at } : {}),
    });
    const target = [notification.userId, notification.dedupeKey];
    const stored = await (
      repeat?.on === "bump"
        ? insert.onConflictDoUpdate({
            target,
            set: {
              createdAt: sql`greatest(${notification.createdAt}, excluded.created_at)`,
              readAt: null,
              // Set from the row as it was: a read row starts counting again.
              count: sql`case when ${notification.readAt} is null then ${notification.count} + 1 else 1 end`,
            },
          })
        : repeat
          ? insert.onConflictDoNothing({ target })
          : insert
    ).returning({ id: notification.id });
    const id = stored[0]?.id ?? null;
    if (!id) return null;
    void this.realtime.notify([recipientId], { type: "notification" });
    this.sweep(recipientId);
    return id;
  }

  async list(
    userId: string,
    query: InboxQuery = {},
  ): Promise<{ items: InboxItem[]; nextCursor: string | null }> {
    const before = this.parseCursor(query.cursor);
    const term = query.q?.trim().slice(0, 64) ?? "";
    const rows = await this.rows(
      and(
        eq(notification.userId, userId),
        ne(notification.type, "message"),
        query.type ? eq(notification.type, query.type) : undefined,
        query.unreadOnly ? isNull(notification.readAt) : undefined,
        term ? this.matching(term) : undefined,
        before
          ? or(
              lt(notification.createdAt, before.at),
              and(eq(notification.createdAt, before.at), lt(notification.id, before.id)),
            )
          : undefined,
      ),
      userId,
      PAGE_SIZE + 1,
    );
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
      .where(
        and(
          eq(notification.userId, userId),
          isNull(notification.readAt),
          this.shownTo(userId),
          ne(notification.type, "message"),
        ),
      );
    return { count: Number(row?.total ?? 0) };
  }

  async counts(userId: string, unreadOnly = false) {
    const [row] = await this.db
      .select({
        all: count(),
        comment: sql<number>`count(*) filter (where ${notification.type} = 'comment')`,
        mention: sql<number>`count(*) filter (where ${notification.type} = 'mention')`,
      })
      .from(notification)
      .where(
        and(
          eq(notification.userId, userId),
          ne(notification.type, "message"),
          this.shownTo(userId),
          ...(unreadOnly ? [isNull(notification.readAt)] : []),
        ),
      );
    return {
      all: Number(row?.all ?? 0),
      comment: Number(row?.comment ?? 0),
      mention: Number(row?.mention ?? 0),
    };
  }

  /** Deletion is scoped to the session recipient, never another member's row. */
  async delete(userId: string, id: string) {
    const [deleted] = await this.db
      .delete(notification)
      .where(and(eq(notification.userId, userId), eq(notification.id, id)))
      .returning({ id: notification.id });
    if (!deleted) throw new NotFoundException("Notification not found.");
    void this.realtime.notify([userId], { type: "notification" });
    return { id: deleted.id };
  }

  /** Ownership is part of every query; another member's id is never readable. */
  async read(userId: string, id: string): Promise<InboxItem> {
    // Only an unread row is touched, so opening it again keeps the first read time.
    const marked = await this.db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(eq(notification.id, id), eq(notification.userId, userId), isNull(notification.readAt)),
      )
      .returning({ id: notification.id });
    const [row] = await this.rows(
      and(eq(notification.id, id), eq(notification.userId, userId)),
      userId,
      1,
    );
    if (!row) throw new NotFoundException("Notification not found.");
    if (marked.length) void this.realtime.notify([userId], { type: "notification" });
    return this.toItem(row);
  }

  async readAll(userId: string) {
    const marked = await this.db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notification.userId, userId),
          isNull(notification.readAt),
          ne(notification.type, "message"),
        ),
      )
      .returning({ id: notification.id });
    if (marked.length) void this.realtime.notify([userId], { type: "notification" });
    return { ok: true };
  }

  /** The member read a chat up to `upTo`; its messages row clears unless newer ones arrived since. */
  async readConversation(userId: string, conversationId: string, upTo: Date): Promise<void> {
    const marked = await this.db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notification.userId, userId),
          eq(notification.dedupeKey, `message:${conversationId}`),
          isNull(notification.readAt),
          lte(notification.createdAt, upTo),
        ),
      )
      .returning({ id: notification.id });
    if (marked.length) void this.realtime.notify([userId], { type: "notification" });
  }

  /** Rows with who did them, as they are now. */
  private async rows(where: SQL | undefined, userId: string, limit: number): Promise<InboxRow[]> {
    return await this.db
      .select({
        id: notification.id,
        type: notification.type,
        actorId: notification.actorId,
        subjectId: notification.subjectId,
        count: notification.count,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
        actorUsername: user.username,
        actorName: user.name,
        actorDisplayName: profile.displayName,
        actorAvatarKey: profile.avatarKey,
        actorSilver: silverCheck(notification.actorId),
      })
      .from(notification)
      .leftJoin(user, eq(user.id, notification.actorId))
      .leftJoin(profile, eq(profile.userId, notification.actorId))
      .where(and(where, this.shownTo(userId)))
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(limit);
  }

  /** Nothing from a member this one has since blocked, or one who's been suspended. */
  private shownTo(userId: string): SQL {
    return sql`(${notBanned(notification.actorId)} and not ${blockedBy(userId, notification.actorId)})`;
  }

  private matching(term: string): SQL | undefined {
    const pattern = containsPattern(term);
    const types = typesMatching(term);
    return or(
      ilike(profile.displayName, pattern),
      ilike(user.username, pattern),
      ilike(user.name, pattern),
      types.length ? inArray(notification.type, types) : undefined,
    );
  }

  private parseCursor(cursor?: string): { at: Date; id: string } | undefined {
    if (!cursor) return undefined;
    try {
      const parsed = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
      return { at: new Date(parsed.at), id: parsed.id };
    } catch {
      throw new BadRequestException("Invalid notification cursor.");
    }
  }

  private async hasBlocked(recipientId: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ blockerId: memberBlock.blockerId })
      .from(memberBlock)
      .where(and(eq(memberBlock.blockerId, recipientId), eq(memberBlock.blockedId, actorId)))
      .limit(1);
    return Boolean(row);
  }

  /** Deletes this member's read rows past retention, every few hours at most, never in the way. */
  private sweep(userId: string, now = Date.now()): void {
    const last = this.swept.get(userId);
    if (last !== undefined && now - last < SWEEP_EVERY_MS) return;
    if (this.swept.size > 10_000) this.swept.clear();
    this.swept.set(userId, now);
    void this.db
      .delete(notification)
      .where(
        and(
          eq(notification.userId, userId),
          lt(
            notification.readAt,
            sql`now() - make_interval(days => ${sql.raw(String(RETENTION_DAYS))})`,
          ),
        ),
      )
      .catch((e: unknown) => this.log.warn(`notification sweep failed: ${String(e)}`));
  }

  private async toItem(row: InboxRow): Promise<InboxItem> {
    return {
      id: row.id,
      type: row.type,
      actor: row.actorId
        ? {
            name: row.actorDisplayName ?? row.actorUsername ?? row.actorName ?? "Someone",
            username: row.actorUsername ?? null,
            avatarUrl: row.actorAvatarKey
              ? await this.storage.presignDownload(row.actorAvatarKey, "sm")
              : null,
            silver: Boolean(row.actorSilver),
          }
        : null,
      url: notificationUrl(row.type, row.subjectId, row.actorUsername ?? null),
      count: row.count,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    };
  }
}
