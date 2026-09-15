import { describe, expect, it, vi } from "vitest";
import { ChatGateway } from "./chat.gateway";
import type { Auth } from "../auth/auth.instance";
import type { ChatService } from "./chat.service";
import type { ConversationsService } from "../conversations/conversations.service";
import type { RedisService } from "../redis/redis.service";
import type { Db } from "../db/db.module";

const authWith = (session: unknown) =>
  ({ api: { getSession: vi.fn(async () => session) } }) as unknown as Auth;

const socketWithHeaders = () => ({
  handshake: { headers: { cookie: "better-auth.session_token=session" } },
  data: {},
  id: "socket-1",
  join: vi.fn(async () => undefined),
  emit: vi.fn(),
  disconnect: vi.fn(),
});

describe("ChatGateway", () => {
  it("returns the send result for Socket.IO acknowledgements", async () => {
    const chat = {
      createMessage: vi.fn(async () => ({ id: "message-1", conversationId: "conv-1" })),
    } as unknown as ChatService;
    const conversations = {
      isParticipant: vi.fn(async () => true),
      participantIds: vi.fn(async () => ["user-1", "user-2"]),
    } as unknown as ConversationsService;
    const redis = {
      bumpUnread: vi.fn(async () => 1),
    } as unknown as RedisService;
    const gateway = new ChatGateway(chat, conversations, redis, {} as Db, authWith(null));
    const emit = vi.fn();
    gateway.server = { to: vi.fn(() => ({ emit })) } as never;
    const socket = { data: { userId: "user-1" } };

    const result = await gateway.onSend(socket as never, {
      conversationId: "conv-1",
      body: "hello",
    });

    expect(result).toEqual({ ok: true, data: { id: "message-1", conversationId: "conv-1" } });
    expect(chat.createMessage).toHaveBeenCalled();
  });

  it("disconnects sockets without a Better Auth session", async () => {
    const socket = socketWithHeaders();
    const gateway = new ChatGateway(
      {} as ChatService,
      {} as ConversationsService,
      {} as RedisService,
      {} as Db,
      authWith(null),
    );

    await gateway.handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("uses the Better Auth session user id for a socket", async () => {
    const socket = socketWithHeaders();
    const db = {
      select: () => ({
        from: () => ({ where: async () => [] }),
      }),
    } as unknown as Db;
    const redis = {
      addSocket: vi.fn(async () => ({ becameOnline: false })),
      onlineUsers: vi.fn(async () => []),
    } as unknown as RedisService;
    const conversations = {
      rebuildUnread: vi.fn(async () => ({})),
    } as unknown as ConversationsService;
    const gateway = new ChatGateway(
      {} as ChatService,
      conversations,
      redis,
      db,
      authWith({ user: { id: "user-1" }, session: { id: "session-1" } }),
    );
    gateway.server = { emit: vi.fn() } as never;
    await gateway.handleConnection(socket as never);

    expect(socket.data.userId).toBe("user-1");
    expect(redis.addSocket).toHaveBeenCalledWith("user-1", "socket-1");
    expect(conversations.rebuildUnread).toHaveBeenCalledWith("user-1");
  });
});
