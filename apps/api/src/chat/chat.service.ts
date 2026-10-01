import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { conversation, conversationParticipant, message, profile, user } from "../db/schema";
import { notBanned } from "../moderation/admins";
import { PresenceService } from "../presence/presence.service";
import { PushService } from "../push/push.service";
import { RealtimeService } from "../realtime/realtime.service";
import { StorageService } from "../storage/storage.service";
import { chatDay, NEW_CHAT_LIMIT, newChatsPerDay } from "./allowance";
import type { ChatAllowanceDto, ChatPeerDto, ConversationSummaryDto, MessageDto } from "./dto";

/**
 * Threads a member may open per day, written in or not. The new-chat allowance
 * is what limits reaching out; this only stops empty threads piling up.
 */
export const MAX_NEW_CONVERSATIONS_PER_DAY = 30;
/** Messages a member may send per minute, across all their threads. */
export const MAX_MESSAGES_PER_MINUTE = 30;
const LIST_LIMIT = 50;

type MessageRow = typeof message.$inferSelect;
/** Who's asking: the session user, whose verified email decides their limits. */
type Member = { id: string; email: string; emailVerified: boolean };
/** The client or an open transaction: both run the same queries. */
type Queryable = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

function toDto(m: MessageRow): MessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    body: m.body ?? "",
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
  };
}

/** A sortable, unique position for a message: time first, id to break ties. */
function positionOf(id: string) {
  return sql`(select "created_at", "id" from "message" where "id" = ${id})`;
}

@Injectable()
export class ChatService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  /**
   * Canonical, order-independent key for a 1:1 thread. Sorting means
   * `startDm(a, b)` and `startDm(b, a)` land on the same row, and the UNIQUE
   * index settles two requests racing to create it.
   */
  private dmKey(a: string, b: string) {
    return [a, b].sort().join(":");
  }

  async startDm(self: Member, otherId: string): Promise<string> {
    const selfId = self.id;
    if (selfId === otherId) throw new BadRequestException("You can't message yourself.");
    const [target] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, otherId), notBanned(user.id)))
      .limit(1);
    if (!target) throw new NotFoundException("Member not found.");

    const key = this.dmKey(selfId, otherId);
    const [existing] = await this.db
      .select({ id: conversation.id })
      .from(conversation)
      .where(eq(conversation.dmKey, key))
      .limit(1);
    if (!existing && newChatsPerDay(self) !== null) await this.assertCanOpenConversation(selfId);

    // One transaction, so a thread can never exist without both members in it.
    // Re-adding the members on an existing thread is a no-op, and repairs one
    // left half-made by anything before this code.
    return this.db.transaction(async (tx) => {
      let id = existing?.id;
      if (!id) {
        const [created] = await tx
          .insert(conversation)
          .values({ kind: "dm", dmKey: key, createdBy: selfId })
          .onConflictDoNothing()
          .returning({ id: conversation.id });
        id =
          created?.id ??
          (
            await tx
              .select({ id: conversation.id })
              .from(conversation)
              .where(eq(conversation.dmKey, key))
              .limit(1)
          )[0]?.id;
      }
      if (!id) throw new InternalServerErrorException("Could not open the conversation.");
      await tx
        .insert(conversationParticipant)
        .values([
          { conversationId: id, userId: selfId },
          { conversationId: id, userId: otherId },
        ])
        .onConflictDoNothing();
      return id;
    });
  }

  private async assertCanOpenConversation(selfId: string) {
    const [row] = await this.db
      .select({ n: count() })
      .from(conversation)
      .where(
        and(
          eq(conversation.createdBy, selfId),
          gt(conversation.createdAt, sql`now() - interval '1 day'`),
        ),
      );
    if (Number(row?.n ?? 0) >= MAX_NEW_CONVERSATIONS_PER_DAY) {
      throw new HttpException(
        "You've started a lot of new conversations today. Try again tomorrow.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Not a member and no such thread look the same from outside: both are 404. */
  async assertMember(conversationId: string, userId: string): Promise<void> {
    const [row] = await this.db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.userId, userId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Conversation not found.");
  }

  async sendMessage(
    sender: Member,
    conversationId: string,
    input: { body: string; clientId?: string },
  ): Promise<MessageDto & { clientId: string | null }> {
    const senderId = sender.id;
    await this.assertMember(conversationId, senderId);
    const [peer] = await this.db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          ne(conversationParticipant.userId, senderId),
          notBanned(conversationParticipant.userId),
        ),
      )
      .limit(1);
    if (!peer) throw new BadRequestException("This member is no longer on Kinkord.");

    const [recent] = await this.db
      .select({ n: count() })
      .from(message)
      .where(
        and(
          eq(message.senderId, senderId),
          gt(message.createdAt, sql`now() - interval '1 minute'`),
        ),
      );
    if (Number(recent?.n ?? 0) >= MAX_MESSAGES_PER_MINUTE) {
      throw new HttpException(
        "You're sending messages too fast. Wait a moment.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const limit = newChatsPerDay(sender);
    const saved =
      limit !== null && !(await this.hasMessages(conversationId))
        ? await this.startChat(senderId, conversationId, input, limit)
        : await this.insertMessage(this.db, senderId, conversationId, input);
    // Both members' open apps hear of it at once, the sender's other tabs too.
    void this.realtime.notify([peer.userId, senderId], { type: "message", conversationId });
    // And their phone, if the app isn't open on this thread.
    this.push.newMessage(senderId, peer.userId, conversationId);
    return saved;
  }

  /**
   * A first message starts a new chat, which the daily allowance counts. The
   * lock queues this member's first messages one at a time, so two sent at
   * once can't both slip in under the limit.
   */
  private startChat(
    senderId: string,
    conversationId: string,
    input: { body: string; clientId?: string },
    limit: number,
  ): Promise<MessageDto & { clientId: string | null }> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`new-chat:${senderId}`}))`);
      const day = chatDay(new Date());
      if ((await this.chatsStartedSince(tx, senderId, day.start)) >= limit) {
        throw new HttpException(
          {
            code: NEW_CHAT_LIMIT,
            message:
              "You've already started a new chat today. You can message someone new after midnight.",
            resetsAt: day.end.toISOString(),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return this.insertMessage(tx, senderId, conversationId, input);
    });
  }

  private async insertMessage(
    q: Queryable,
    senderId: string,
    conversationId: string,
    input: { body: string; clientId?: string },
  ): Promise<MessageDto & { clientId: string | null }> {
    const [created] = await q
      .insert(message)
      .values({ conversationId, senderId, body: input.body })
      .returning();
    // Keeps the list ordered by activity without a join on message.
    await q
      .update(conversation)
      .set({ lastMessageAt: created.createdAt })
      .where(eq(conversation.id, conversationId));
    return { ...toDto(created), clientId: input.clientId ?? null };
  }

  private async hasMessages(conversationId: string): Promise<boolean> {
    const [first] = await this.db
      .select({ id: message.id })
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .limit(1);
    return Boolean(first);
  }

  /**
   * Chats this member started since a moment: messages they sent that were
   * the first in their thread. Deleted ones still count, so deleting and
   * resending can't win a second chat.
   */
  private async chatsStartedSince(q: Queryable, userId: string, since: Date): Promise<number> {
    const [row] = await q
      .select({ n: count() })
      .from(message)
      .where(
        and(
          eq(message.senderId, userId),
          gte(message.createdAt, since),
          sql`not exists (select 1 from "message" as "earlier" where "earlier"."conversation_id" = ${message.conversationId} and ("earlier"."created_at", "earlier"."id") < (${message.createdAt}, ${message.id}))`,
        ),
      );
    return Number(row?.n ?? 0);
  }

  /** Today's new-chat allowance, so the app can say so before anyone types. */
  async allowance(who: Member): Promise<ChatAllowanceDto> {
    const limit = newChatsPerDay(who);
    if (limit === null) return { newChatsPerDay: null };
    const day = chatDay(new Date());
    return {
      newChatsPerDay: limit,
      usedToday: await this.chatsStartedSince(this.db, who.id, day.start),
      resetsAt: day.end.toISOString(),
    };
  }

  /**
   * A page of the thread, always oldest first. `before` walks back from a
   * message; `after` returns what arrived since one, which is how an open
   * thread polls. Positions compare in the database, where timestamps keep the
   * microseconds a JavaScript Date would drop.
   */
  async history(
    userId: string,
    conversationId: string,
    opts: { before?: string; after?: string; limit: number },
  ): Promise<MessageDto[]> {
    await this.assertMember(conversationId, userId);
    const pivot = opts.before ?? opts.after;
    if (pivot) {
      const [known] = await this.db
        .select({ id: message.id })
        .from(message)
        .where(and(eq(message.id, pivot), eq(message.conversationId, conversationId)))
        .limit(1);
      if (!known) throw new BadRequestException("Unknown message.");
    }
    const conditions = [eq(message.conversationId, conversationId), isNull(message.deletedAt)];
    if (opts.before) {
      conditions.push(sql`(${message.createdAt}, ${message.id}) < ${positionOf(opts.before)}`);
    }
    if (opts.after) {
      conditions.push(sql`(${message.createdAt}, ${message.id}) > ${positionOf(opts.after)}`);
    }
    const rows = await this.db
      .select()
      .from(message)
      .where(and(...conditions))
      .orderBy(
        ...(opts.after
          ? [asc(message.createdAt), asc(message.id)]
          : [desc(message.createdAt), desc(message.id)]),
      )
      .limit(opts.limit);
    return (opts.after ? rows : rows.reverse()).map(toDto);
  }

  /** Moves this member's read pointer forward to a message; never backwards. */
  async markRead(userId: string, conversationId: string, messageId: string): Promise<void> {
    await this.assertMember(conversationId, userId);
    const [known] = await this.db
      .select({ id: message.id })
      .from(message)
      .where(and(eq(message.id, messageId), eq(message.conversationId, conversationId)))
      .limit(1);
    if (!known) throw new BadRequestException("Unknown message.");
    const readAt = sql`(select "created_at" from "message" where "id" = ${messageId})`;
    await this.db
      .update(conversationParticipant)
      .set({ lastReadAt: readAt, lastReadMessageId: messageId })
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.userId, userId),
          sql`(${conversationParticipant.lastReadAt} is null or ${conversationParticipant.lastReadAt} < ${readAt})`,
        ),
      );
  }

  /**
   * The inbox. Threads whose other member was suspended or deleted are left
   * out: they can't be answered, and a block should read as gone. A thread
   * nobody has written in yet belongs to whoever opened it: the other member
   * first hears of it with the first message, which the daily allowance counts.
   */
  async listConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const rows = await this.summaries(userId, null);
    return rows
      .filter(
        ({ summary, openedBy }) =>
          summary.peer !== null && (summary.lastMessage !== null || openedBy === userId),
      )
      .map((r) => r.summary);
  }

  /** One thread's header: who it's with and whether they're around. */
  async conversation(userId: string, conversationId: string): Promise<ConversationSummaryDto> {
    await this.assertMember(conversationId, userId);
    const [row] = await this.summaries(userId, conversationId);
    if (!row) throw new NotFoundException("Conversation not found.");
    return row.summary;
  }

  /** A fixed handful of queries however many threads there are, not one per row. */
  private async summaries(
    userId: string,
    only: string | null,
  ): Promise<Array<{ summary: ConversationSummaryDto; openedBy: string | null }>> {
    const mine = await this.db
      .select({
        id: conversation.id,
        kind: conversation.kind,
        lastMessageAt: conversation.lastMessageAt,
        createdBy: conversation.createdBy,
      })
      .from(conversationParticipant)
      .innerJoin(conversation, eq(conversation.id, conversationParticipant.conversationId))
      .where(
        and(
          eq(conversationParticipant.userId, userId),
          only ? eq(conversation.id, only) : undefined,
        ),
      )
      .orderBy(desc(conversation.lastMessageAt))
      .limit(LIST_LIMIT);
    if (mine.length === 0) return [];
    const ids = mine.map((c) => c.id);

    const peers = await this.db
      .select({
        conversationId: conversationParticipant.conversationId,
        userId: conversationParticipant.userId,
        username: user.username,
        name: user.name,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        lastSeenAt: profile.lastSeenAt,
      })
      .from(conversationParticipant)
      .innerJoin(user, eq(user.id, conversationParticipant.userId))
      .leftJoin(profile, eq(profile.userId, conversationParticipant.userId))
      .where(
        and(
          inArray(conversationParticipant.conversationId, ids),
          ne(conversationParticipant.userId, userId),
          notBanned(conversationParticipant.userId),
        ),
      );

    const lastRows = await this.db
      .selectDistinctOn([message.conversationId])
      .from(message)
      .where(and(inArray(message.conversationId, ids), isNull(message.deletedAt)))
      .orderBy(message.conversationId, desc(message.createdAt), desc(message.id));

    // Unread: written by someone else after my read pointer.
    const unreadRows = await this.db
      .select({ conversationId: message.conversationId, unread: count() })
      .from(message)
      .innerJoin(
        conversationParticipant,
        and(
          eq(conversationParticipant.conversationId, message.conversationId),
          eq(conversationParticipant.userId, userId),
        ),
      )
      .where(
        and(
          inArray(message.conversationId, ids),
          isNull(message.deletedAt),
          ne(message.senderId, userId),
          sql`${message.createdAt} > coalesce(${conversationParticipant.lastReadAt}, 'epoch')`,
        ),
      )
      .groupBy(message.conversationId);

    const peerByConv = new Map<string, ChatPeerDto>(
      await Promise.all(
        peers.map(
          async (p) =>
            [
              p.conversationId,
              {
                userId: p.userId,
                username: p.username,
                displayName: p.displayName ?? p.username ?? p.name,
                avatarUrl: p.avatarKey
                  ? await this.storage.presignDownload(p.avatarKey, "sm")
                  : null,
                online: PresenceService.isOnline(p.lastSeenAt),
              },
            ] as const,
        ),
      ),
    );
    const lastByConv = new Map(lastRows.map((m) => [m.conversationId, toDto(m)]));
    const unreadByConv = new Map(unreadRows.map((u) => [u.conversationId, Number(u.unread)]));

    return mine.map((c) => ({
      summary: {
        id: c.id,
        kind: c.kind,
        lastMessageAt: c.lastMessageAt.toISOString(),
        peer: peerByConv.get(c.id) ?? null,
        lastMessage: lastByConv.get(c.id) ?? null,
        unreadCount: unreadByConv.get(c.id) ?? 0,
      },
      openedBy: c.createdBy,
    }));
  }
}
