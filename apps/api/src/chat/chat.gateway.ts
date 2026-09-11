import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { eq } from 'drizzle-orm';
import { ChatService } from './chat.service';
import { ConversationsService } from '../conversations/conversations.service';
import { RedisService } from '../redis/redis.service';
import { DbService } from '../db/db.service';
import { conversationParticipants as cpTbl } from '../db/schema';

type Ack<T = any> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger(ChatGateway.name);

  constructor(
    private chat: ChatService,
    private convs: ConversationsService,
    private redis: RedisService,
    private db: DbService,
  ) {}

  private room(userId: string) { return `user:${userId}`; }
  private convRoom(id: string) { return `conv:${id}`; }

  async handleConnection(socket: Socket) {
    const userId = (socket.handshake.auth?.userId as string) || (socket.handshake.query?.userId as string);
    if (!userId) { socket.disconnect(true); return; }
    socket.data.userId = userId;

    await socket.join(this.room(userId));

    // Join all conversation rooms this user belongs to.
    const parts = await this.db.db
      .select({ conversationId: cpTbl.conversationId })
      .from(cpTbl)
      .where(eq(cpTbl.userId, userId));
    for (const p of parts) await socket.join(this.convRoom(p.conversationId));

    const { becameOnline } = await this.redis.addSocket(userId, socket.id);

    // Send a presence snapshot to this fresh client.
    const online = await this.redis.onlineUsers();
    socket.emit('presence:snapshot', { online });

    if (becameOnline) {
      this.server.emit('presence:update', { userId, online: true });
    }

    // Rebuild unread counters from DB (source of truth) and push.
    const unread = await this.convs.rebuildUnread(userId);
    socket.emit('unread:snapshot', unread);
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { becameOffline } = await this.redis.removeSocket(userId, socket.id);
    if (becameOffline) {
      this.server.emit('presence:update', { userId, online: false });
    }
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: {
      conversationId: string;
      body?: string;
      clientId?: string;
      attachmentIds?: string[];
    },
    @ConnectedSocket() ackCb?: any,
  ) {
    // Nest passes an ack callback when the client requests one.
    return this.handleSend(socket, payload, ackCb);
  }

  private async handleSend(
    socket: Socket,
    payload: { conversationId: string; body?: string; clientId?: string; attachmentIds?: string[] },
    ack?: Ack,
  ) {
    const senderId = socket.data.userId as string;
    try {
      if (!(await this.convs.isParticipant(payload.conversationId, senderId))) {
        ack?.({ ok: false, error: 'not_a_participant' });
        return;
      }
      const message = await this.chat.createMessage({
        conversationId: payload.conversationId,
        senderId,
        body: payload.body ?? null,
        clientId: payload.clientId ?? null,
        attachmentIds: payload.attachmentIds ?? [],
      });

      // Fan out to everyone in the conversation room (including the sender's other tabs).
      this.server.to(this.convRoom(payload.conversationId)).emit('message:new', message);

      // Bump unread for offline/away participants.
      const participants = await this.convs.participantIds(payload.conversationId);
      for (const p of participants) {
        if (p === senderId) continue;
        // Only bump if the user isn't currently "in" the conversation.
        // Simplest robust signal: bump always, clear on explicit read.
        const count = await this.redis.bumpUnread(p, payload.conversationId);
        this.server.to(this.room(p)).emit('unread:bump', {
          conversationId: payload.conversationId,
          count,
        });
      }

      ack?.({ ok: true, data: message });
    } catch (e: any) {
      this.log.error('message:send failed', e);
      ack?.({ ok: false, error: e?.message ?? 'send_failed' });
    }
  }

  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: string; messageId: string },
  ) {
    const userId = socket.data.userId as string;
    await this.convs.markRead(payload.conversationId, userId, payload.messageId);
    this.server.to(this.convRoom(payload.conversationId)).emit('message:read', {
      conversationId: payload.conversationId,
      userId,
      messageId: payload.messageId,
    });
    socket.emit('unread:cleared', { conversationId: payload.conversationId });
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: string; typing: boolean },
  ) {
    const userId = socket.data.userId as string;
    socket.to(this.convRoom(payload.conversationId)).emit('typing', {
      conversationId: payload.conversationId,
      userId,
      typing: payload.typing,
    });
  }
}