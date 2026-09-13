import { describe, expect, it, vi } from "vitest";
import { ChatGateway } from "./chat.gateway";
import type { Auth } from "../auth/auth.instance";
import type { ChatService } from "./chat.service";
import type { ConversationsService } from "../conversations/conversations.service";
import type { RedisService } from "../redis/redis.service";
import type { DbService } from "../db/db.service";

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
  it("disconnects sockets without a Better Auth session", async () => {
    const socket = socketWithHeaders();
    const gateway = new ChatGateway(
      {} as ChatService,
      {} as ConversationsService,
      {} as RedisService,
      {} as DbService,
      authWith(null),
    );

    await gateway.handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("uses the Better Auth session user id for a socket", async () => {
    const socket = socketWithHeaders();
    const db = {
      db: {
        select: () => ({
          from: () => ({ where: async () => [] }),
        }),
      },
    } as unknown as DbService;
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
