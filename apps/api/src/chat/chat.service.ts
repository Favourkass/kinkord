import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gt, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import {
  conversation,
  conversationParticipant,
  message,
  messageMedia,
  profile,
  user,
} from "../db/schema";
import type { ConversationSummaryDto, MessageDto, SendMessageInput } from "./dto";
import { RealtimePublisher } from "./realtime.publisher";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class ChatService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly publisher: RealtimePublisher,
    private readonly storage: StorageService,
  ) {}

  /**
   * Canonical, order-independent key for a 1:1 DM. Sorting the ids means
   * `startDm(a, b)` and `startDm(b, a)` produce the same key, and the UNIQUE
   * index rejects the second insert if both requests arrive at once.
   */
  private dmKey(a: string, b: string) {
    return [a, b].sort().join(":");
  }

  async startDm(selfId: string, otherId: string): Promise<string> {
    if (selfId === otherId) throw new ForbiddenException("You cannot message yourself.");
    const key = this.dmKey(selfId, otherId);

    const [existing] = await this.db
      .select({ id: conversation.id })
      .from(conversation)
      .where(eq(conversation.dmKey, key))
      .limit(1);
    if (existing) return existing.id;

    const [created] = await this.db
      .insert(conversation)
      .values({ kind: "dm", dmKey: key })
      .onConflictDoNothing()
      .returning({ id: conversation.id });

    // Lost the race to another request: the row exists, read it back.
    const id =
      created?.id ??
      (
        await this.db
          .select({ id: conversation.id })
          .from(conversation)
          .where(eq(conversation.dmKey, key))
          .limit(1)
      )[0]?.id;
    if (!id) throw new NotFoundException("Could not open the conversation.");

    await this.db
      .insert(conversationParticipant)
      .values([
        { conversationId: id, userId: selfId },
        { conversationId: id, userId: otherId },
      ])
      .onConflictDoNothing();

    return id;
  }

  async participantIds(conversationId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(eq(conversationParticipant.conversationId, conversationId));
    return rows.map((r) => r.userId);
  }

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
    if (!row) throw new ForbiddenException("You are not in this conversation.");
  }

  async sendMessage(senderId: string, input: SendMessageInput): Promise<MessageDto> {
    await this.assertMember(input.conversationId, senderId);

    const [created] = await this.db
      .insert(message)
      .values({
        conversationId: input.conversationId,
        senderId,
        body: input.body?.length ? input.body : null,
      })
      .returning();

    if (input.media.length > 0) {
      await this.db.insert(messageMedia).values(
        input.media.map((m, i) => ({
          messageId: created.id,
          kind: m.kind,
          key: m.key,
          posterKey: m.posterKey ?? null,
          position: i,
        })),
      );
    }

    // Keeps the conversation list ordered by activity without a message join.
    await this.db
      .update(conversation)
      .set({ lastMessageAt: created.createdAt })
      .where(eq(conversation.id, input.conversationId));

    const dto = await this.toDto(created.id);
    const recipients = await this.participantIds(input.conversationId);
    // Every member including the sender's other devices; the originating socket
    // reconciles via the ack, so no duplicate is rendered client-side.
    this.publisher.toUsers(recipients, "message:new", dto);
    return dto;
  }

  async history(
    userId: string,
    conversationId: string,
    before: string | undefined,
    limit: number,
  ): Promise<MessageDto[]> {
    await this.assertMember(conversationId, userId);
    const rows = await this.db
      .select()
      .from(message)
      .where(
        and(
          eq(message.conversationId, conversationId),
          isNull(message.deletedAt),
          before ? lt(message.createdAt, new Date(before)) : undefined,
        ),
      )
      .orderBy(desc(message.createdAt))
      .limit(limit);
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const media = await this.db
      .select()
      .from(messageMedia)
      .where(inArray(messageMedia.messageId, ids));
    const byMessage = new Map<string, MessageDto["media"]>();
    for (const m of media) {
      const list = byMessage.get(m.messageId) ?? [];
      list.push({
        id: m.id,
        kind: m.kind,
        key: m.key,
        posterKey: m.posterKey,
        position: m.position,
      });
      byMessage.set(m.messageId, list);
    }
    return rows.map((r) =>
      this.rowToDto(
        r,
        (byMessage.get(r.id) ?? []).sort((a, b) => a.position - b.position),
      ),
    );
  }

  async markRead(userId: string, conversationId: string, messageId: string): Promise<void> {
    await this.assertMember(conversationId, userId);
    await this.db
      .update(conversationParticipant)
      .set({ lastReadAt: new Date(), lastReadMessageId: messageId })
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.userId, userId),
        ),
      );
    const recipients = await this.participantIds(conversationId);
    this.publisher.toUsers(recipients, "message:read", {
      conversationId,
      userId,
      messageId,
    });
  }

  /**
   * The conversation list for the signed-in member. Three grouped queries in
   * parallel — the conversations, the last message per conversation, the unread
   * counts — rather than N+1 per row, because this is the first screen opened
   * on every app launch and it has to stay flat as inboxes fill up.
   */
  async listConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const convRows = await this.db
      .select({
        id: conversation.id,
        kind: conversation.kind,
        lastMessageAt: conversation.lastMessageAt,
      })
      .from(conversationParticipant)
      .innerJoin(conversation, eq(conversation.id, conversationParticipant.conversationId))
      .where(eq(conversationParticipant.userId, userId))
      .orderBy(desc(conversation.lastMessageAt))
      .limit(50);

    if (convRows.length === 0) return [];
    const ids = convRows.map((c) => c.id);

    // Participants, joined to profile so the header can render name + avatar.
    const participantRows = await this.db
      .select({
        conversationId: conversationParticipant.conversationId,
        userId: conversationParticipant.userId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
      })
      .from(conversationParticipant)
      .innerJoin(user, eq(user.id, conversationParticipant.userId))
      .leftJoin(profile, eq(profile.userId, conversationParticipant.userId))
      .where(inArray(conversationParticipant.conversationId, ids));

    // Last message per conversation. A correlated subquery is the right tool
    // here — window functions would scan the whole table, and this row count is
    // bounded by "conversations the member is in".
    const lastRows = await this.db
      .select({
        conversationId: message.conversationId,
        id: message.id,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
      })
      .from(message)
      .where(
        and(
          inArray(message.conversationId, ids),
          isNull(message.deletedAt),
          sql`${message.createdAt} = (
            select max(m2.created_at) from message m2
            where m2.conversation_id = ${message.conversationId} and m2.deleted_at is null
          )`,
        ),
      );

    // Unread: newer than my last-read pointer, and written by someone else.
    const unreadRows = await this.db
      .select({
        conversationId: message.conversationId,
        unread: sql<number>`count(*)::int`,
      })
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
          gt(message.createdAt, sql`coalesce(${conversationParticipant.lastReadAt}, 'epoch')`),
        ),
      )
      .groupBy(message.conversationId);

    const lastByConv = new Map(lastRows.map((m) => [m.conversationId, m]));
    const unreadByConv = new Map(unreadRows.map((u) => [u.conversationId, u.unread]));
    const participantsByConv = new Map<string, ConversationSummaryDto["participants"]>();
    for (const p of participantRows) {
      const list = participantsByConv.get(p.conversationId) ?? [];
      list.push({
        userId: p.userId,
        username: p.username,
        displayName: p.displayName ?? p.username ?? "Member",
        avatarUrl: p.avatarKey ? await this.storage.presignDownload(p.avatarKey, "sm") : null,
      });
      participantsByConv.set(p.conversationId, list);
    }

    return convRows.map((c) => {
      const last = lastByConv.get(c.id);
      return {
        id: c.id,
        kind: c.kind,
        lastMessageAt: c.lastMessageAt.toISOString(),
        participants: participantsByConv.get(c.id) ?? [],
        lastMessage: last
          ? {
              id: last.id,
              conversationId: last.conversationId,
              senderId: last.senderId,
              body: last.body,
              createdAt: last.createdAt.toISOString(),
              editedAt: last.editedAt?.toISOString() ?? null,
              media: [],
            }
          : null,
        unreadCount: unreadByConv.get(c.id) ?? 0,
      };
    });
  }

  private async toDto(messageId: string): Promise<MessageDto> {
    const [row] = await this.db.select().from(message).where(eq(message.id, messageId)).limit(1);
    if (!row) throw new NotFoundException("Message not found.");
    const media = await this.db
      .select()
      .from(messageMedia)
      .where(eq(messageMedia.messageId, messageId));
    return this.rowToDto(
      row,
      media
        .sort((a, b) => a.position - b.position)
        .map((m) => ({
          id: m.id,
          kind: m.kind,
          key: m.key,
          posterKey: m.posterKey,
          position: m.position,
        })),
    );
  }

  private rowToDto(row: typeof message.$inferSelect, media: MessageDto["media"]): MessageDto {
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      media,
    };
  }
}
