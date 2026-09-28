import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { conversation, conversationParticipant, message, profile, user } from "../db/schema";
import { notBanned } from "../moderation/admins";
import { PresenceService } from "../presence/presence.service";
import { StorageService } from "../storage/storage.service";
import type { ChatPeerDto, ConversationSummaryDto, MessageDto } from "./dto";

/** New threads a member may open per day: enough to be social, too few to spam. */
export const MAX_NEW_CONVERSATIONS_PER_DAY = 30;
/** Messages a member may send per minute, across all their threads. */
export const MAX_MESSAGES_PER_MINUTE = 30;
const LIST_LIMIT = 50;

type MessageRow = typeof message.$inferSelect;

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
  ) {}

  /**
   * Canonical, order-independent key for a 1:1 thread. Sorting means
   * `startDm(a, b)` and `startDm(b, a)` land on the same row, and the UNIQUE
   * index settles two requests racing to create it.
   */
  private dmKey(a: string, b: string) {
    return [a, b].sort().join(":");
  }

  async startDm(selfId: string, otherId: string): Promise<string> {
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
    if (!existing) await this.assertCanOpenConversation(selfId);

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
    senderId: string,
    conversationId: string,
    input: { body: string; clientId?: string },
  ): Promise<MessageDto & { clientId: string | null }> {
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

    const [created] = await this.db
      .insert(message)
      .values({ conversationId, senderId, body: input.body })
      .returning();
    // Keeps the list ordered by activity without a join on message.
    await this.db
      .update(conversation)
      .set({ lastMessageAt: created.createdAt })
      .where(eq(conversation.id, conversationId));
    return { ...toDto(created), clientId: input.clientId ?? null };
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
   * out: they can't be answered, and a block should read as gone.
   */
  async listConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const summaries = await this.summaries(userId, null);
    return summaries.filter((s) => s.peer !== null);
  }

  /** One thread's header: who it's with and whether they're around. */
  async conversation(userId: string, conversationId: string): Promise<ConversationSummaryDto> {
    await this.assertMember(conversationId, userId);
    const [summary] = await this.summaries(userId, conversationId);
    if (!summary) throw new NotFoundException("Conversation not found.");
    return summary;
  }

  /** A fixed handful of queries however many threads there are, not one per row. */
  private async summaries(userId: string, only: string | null): Promise<ConversationSummaryDto[]> {
    const mine = await this.db
      .select({
        id: conversation.id,
        kind: conversation.kind,
        lastMessageAt: conversation.lastMessageAt,
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
      id: c.id,
      kind: c.kind,
      lastMessageAt: c.lastMessageAt.toISOString(),
      peer: peerByConv.get(c.id) ?? null,
      lastMessage: lastByConv.get(c.id) ?? null,
      unreadCount: unreadByConv.get(c.id) ?? 0,
    }));
  }
}
