import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { conversations as convTbl, messages as msgTbl } from '../db/schema';
import { ConversationsService } from '../conversations/conversations.service';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class ChatService {
  constructor(
    private db: DbService,
    private convs: ConversationsService,
    private uploads: UploadsService,
  ) {}

  async createMessage(input: {
    conversationId: string;
    senderId: string;
    body?: string | null;
    clientId?: string | null;
    attachmentIds?: string[];
  }) {
    const { conversationId, senderId, body, clientId, attachmentIds = [] } = input;

    // Idempotency: if we already stored this clientId, return it.
    if (clientId) {
      const existing = await this.db.db.query.messages.findFirst({
        where: (m, { and, eq }) => and(eq(m.senderId, senderId), eq(m.clientId, clientId)),
      });
      if (existing) return this.hydrate(existing);
    }

    const [created] = await this.db.db
      .insert(msgTbl)
      .values({ conversationId, senderId, body: body ?? null, clientId: clientId ?? null })
      .returning();

    if (attachmentIds.length) {
      await this.uploads.attachToMessage(attachmentIds, created.id, senderId);
    }

    await this.db.db
      .update(convTbl)
      .set({ lastMessageAt: created.createdAt })
      .where(eq(convTbl.id, conversationId));

    return this.hydrate(created);
  }

  async hydrate(msg: typeof msgTbl.$inferSelect) {
    const atts = await this.db.db
      .select()
      .from((await import('../db/schema')).attachments)
      .where(eq((await import('../db/schema')).attachments.messageId, msg.id));
    return { ...msg, attachments: await this.uploads.decorate(atts) };
  }

  async ping() { return { ok: true, ts: Date.now() }; }
}