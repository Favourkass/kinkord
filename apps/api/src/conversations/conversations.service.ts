import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import {
  attachments as attachmentsTbl,
  conversationParticipants as cp,
  conversations as convTbl,
  messages as msgTbl,
  users as usersTbl,
} from '../db/schema';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ConversationsService {
  constructor(private db: DbService, private redis: RedisService) {}

  private dmKeyFor(a: string, b: string) {
    return [a, b].sort().join(':');
  }

  async listForUser(userId: string) {
    const rows = await this.db.db
      .select({
        id: convTbl.id,
        type: convTbl.type,
        title: convTbl.title,
        lastMessageAt: convTbl.lastMessageAt,
      })
      .from(cp)
      .innerJoin(convTbl, eq(convTbl.id, cp.conversationId))
      .where(eq(cp.userId, userId))
      .orderBy(desc(sql`coalesce(${convTbl.lastMessageAt}, ${convTbl.createdAt})`));

    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);

    const allParticipants = await this.db.db
      .select({
        conversationId: cp.conversationId,
        user: {
          id: usersTbl.id,
          username: usersTbl.username,
          displayName: usersTbl.displayName,
          avatarUrl: usersTbl.avatarUrl,
        },
      })
      .from(cp)
      .innerJoin(usersTbl, eq(usersTbl.id, cp.userId))
      .where(inArray(cp.conversationId, ids));

    const lastMsgs = await this.db.db
      .select()
      .from(msgTbl)
      .where(
        inArray(
          msgTbl.id,
          this.db.db
            .select({ id: sql<string>`distinct on (${msgTbl.conversationId}) ${msgTbl.id}` })
            .from(msgTbl)
            .where(inArray(msgTbl.conversationId, ids))
            .orderBy(msgTbl.conversationId, desc(msgTbl.createdAt))
            .as('lm'),
        ),
      );

    const unread = await this.redis.unreadSnapshot(userId);

    return rows.map((r) => ({
      ...r,
      participants: allParticipants.filter((p) => p.conversationId === r.id).map((p) => p.user),
      lastMessage: lastMsgs.find((m) => m.conversationId === r.id) ?? null,
      unreadCount: unread[r.id] ?? 0,
    }));
  }

  async ensureDm(userA: string, userB: string) {
    if (userA === userB) throw new NotFoundException('Cannot DM yourself');
    const key = this.dmKeyFor(userA, userB);
    const existing = await this.db.db.query.conversations.findFirst({
      where: (c, { eq }) => eq(c.dmKey, key),
    });
    if (existing) return existing;

    const [created] = await this.db.db
      .insert(convTbl)
      .values({ type: 'dm', dmKey: key })
      .onConflictDoNothing()
      .returning();

    if (created) {
      await this.db.db.insert(cp).values([
        { conversationId: created.id, userId: userA },
        { conversationId: created.id, userId: userB },
      ]);
      return created;
    }
    return this.db.db.query.conversations.findFirst({ where: (c, { eq }) => eq(c.dmKey, key) });
  }

  async isParticipant(conversationId: string, userId: string) {
    const row = await this.db.db.query.conversationParticipants.findFirst({
      where: (p, { and, eq }) => and(eq(p.conversationId, conversationId), eq(p.userId, userId)),
    });
    return !!row;
  }

  async participantIds(conversationId: string) {
    const rows = await this.db.db
      .select({ userId: cp.userId })
      .from(cp)
      .where(eq(cp.conversationId, conversationId));
    return rows.map((r) => r.userId);
  }

  async listMessages(conversationId: string, userId: string, before?: string, limit = 50) {
    if (!(await this.isParticipant(conversationId, userId)))
      throw new NotFoundException('Conversation not found');

    const rows = await this.db.db
      .select()
      .from(msgTbl)
      .where(
        before
          ? and(eq(msgTbl.conversationId, conversationId), sql`${msgTbl.createdAt} < (select created_at from messages where id = ${before})`)
          : eq(msgTbl.conversationId, conversationId),
      )
      .orderBy(desc(msgTbl.createdAt))
      .limit(limit);

    const ids = rows.map((r) => r.id);
    const atts = ids.length
      ? await this.db.db.select().from(attachmentsTbl).where(inArray(attachmentsTbl.messageId, ids))
      : [];

    return rows.reverse().map((m) => ({
      ...m,
      attachments: atts.filter((a) => a.messageId === m.id),
    }));
  }

  async markRead(conversationId: string, userId: string, messageId: string) {
    if (!(await this.isParticipant(conversationId, userId))) return;
    await this.db.db
      .update(cp)
      .set({ lastReadMessageId: messageId })
      .where(and(eq(cp.conversationId, conversationId), eq(cp.userId, userId)));
    await this.redis.clearUnread(userId, conversationId);
  }

  async rebuildUnread(userId: string): Promise<Record<string, number>> {
    const rows = await this.db.db
      .select({
        conversationId: cp.conversationId,
        lastReadMessageId: cp.lastReadMessageId,
      })
      .from(cp)
      .where(eq(cp.userId, userId));

    const out: Record<string, number> = {};
    for (const r of rows) {
      const [{ count }] = (await this.db.db.execute(sql`
        select count(*)::int as count from messages m
        where m.conversation_id = ${r.conversationId}
          and m.sender_id <> ${userId}
          and (
            ${r.lastReadMessageId}::uuid is null
            or m.created_at > (select created_at from messages where id = ${r.lastReadMessageId})
          )
      `)).rows as any[];
      if (count > 0) {
        out[r.conversationId] = count;
        await this.redis.setUnread(userId, r.conversationId, count);
      } else {
        await this.redis.clearUnread(userId, r.conversationId);
      }
    }
    return out;
  }
}