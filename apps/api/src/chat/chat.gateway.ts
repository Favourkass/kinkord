import { Inject, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { fromNodeHeaders } from "better-auth/node";
import type { Server, Socket } from "socket.io";
import { AUTH, Auth } from "../auth/auth.instance";
import { ChatService } from "./chat.service";
import { markReadSchema, sendMessageSchema, typingSchema } from "./dto";
import { PresenceRedisService } from "./presence-redis.service";
import { RealtimePublisher } from "./realtime.publisher";

interface AuthedSocket extends Socket {
  userId?: string;
}

const webOrigins = (process.env.WEB_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * WebSocket-only on purpose. Adding the polling fallback would force sticky
 * sessions on the ALB target group so a long-poll reconnect lands on the same
 * task — an operational burden we do not need, since every target this app
 * ships to supports WebSocket.
 */
@WebSocketGateway({
  path: "/ws",
  cors: { origin: webOrigins, credentials: true },
  transports: ["websocket"],
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger(ChatGateway.name);

  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly chat: ChatService,
    private readonly presence: PresenceRedisService,
    private readonly publisher: RealtimePublisher,
  ) {}

  afterInit(server: Server): void {
    this.publisher.setServer(server);
  }

  /**
   * Socket auth runs the same `getSession` the HTTP `AuthGuard` uses, against
   * the handshake headers. A socket without a valid session is disconnected
   * immediately — there is no unauthenticated connection in this app.
   */
  async handleConnection(socket: AuthedSocket): Promise<void> {
    try {
      const session = await this.auth.api.getSession({
        headers: fromNodeHeaders(socket.handshake.headers),
      });
      if (!session) {
        socket.disconnect(true);
        return;
      }
      const userId = session.user.id;
      socket.userId = userId;
      // Every socket lives in its owner's room; all fan-out targets that room.
      await socket.join(`user:${userId}`);
      await this.presence.markOnline(userId, socket.id);
      // Everyone hears about it. The Redis adapter fans this across tasks.
      this.server.emit("presence:update", { userId, online: true });
    } catch (err) {
      this.log.warn(`socket auth failed: ${(err as Error).message}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: AuthedSocket): Promise<void> {
    if (!socket.userId) return;
    const wentOffline = await this.presence.markOffline(socket.userId, socket.id);
    // Only announce when the *last* socket closed; a member closing one of two
    // tabs is still online and should not flicker in everyone's UI.
    if (wentOffline) {
      this.server.emit("presence:update", { userId: socket.userId, online: false });
    }
  }

  @SubscribeMessage("message:send")
  async onSend(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: true; clientId?: string; messageId: string } | { ok: false; error: string }> {
    const parsed = sendMessageSchema.safeParse(raw);
    if (!parsed.success || !socket.userId) {
      return {
        ok: false,
        error: parsed.success ? "Not signed in." : "Invalid payload.",
      };
    }
    try {
      const dto = await this.chat.sendMessage(socket.userId, parsed.data);
      return { ok: true, clientId: parsed.data.clientId, messageId: dto.id };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage("message:read")
  async onRead(@ConnectedSocket() socket: AuthedSocket, @MessageBody() raw: unknown) {
    const parsed = markReadSchema.safeParse(raw);
    if (!parsed.success || !socket.userId) return { ok: false as const };
    await this.chat.markRead(socket.userId, parsed.data.conversationId, parsed.data.messageId);
    return { ok: true as const };
  }

  @SubscribeMessage("typing")
  async onTyping(@ConnectedSocket() socket: AuthedSocket, @MessageBody() raw: unknown) {
    const parsed = typingSchema.safeParse(raw);
    if (!parsed.success || !socket.userId) return;
    // Membership check first — nobody learns who's typing in a thread they are
    // not part of.
    await this.chat.assertMember(parsed.data.conversationId, socket.userId);
    const recipients = await this.chat.participantIds(parsed.data.conversationId);
    for (const id of recipients) {
      if (id === socket.userId) continue;
      this.publisher.toUser(id, "typing", {
        conversationId: parsed.data.conversationId,
        userId: socket.userId,
        isTyping: parsed.data.isTyping,
      });
    }
  }
}
