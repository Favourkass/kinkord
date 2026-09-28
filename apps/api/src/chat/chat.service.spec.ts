import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { conversation, conversationParticipant, message } from "../db/schema";
import type { StorageService } from "../storage/storage.service";
import {
  ChatService,
  MAX_MESSAGES_PER_MINUTE,
  MAX_NEW_CONVERSATIONS_PER_DAY,
} from "./chat.service";

/**
 * A stand-in for the Drizzle client: every builder call returns the chain, and
 * each `await` takes the next queued answer, so a spec lists the database's
 * replies in the order the code asks. `transaction(fn)` runs `fn` on the same
 * stand-in, so what happens inside it is recorded too.
 */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        if (prop === "transaction") return (fn: (tx: unknown) => unknown) => fn(root);
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  // Read lazily by `transaction` above, so declaring it after chain() is fine.
  const root: unknown = chain();
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = calls.findIndex((c) => c.op === anchor && c.args[0] === table);
    return start < 0 ? undefined : calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: root as never, calls, after, left: () => queue.length };
}

function make(answers: unknown[]) {
  const q = queuedDb(answers);
  const storage = {
    presignDownload: vi.fn(
      async (key: string, variant?: string) => `https://media/${key}?${variant}`,
    ),
  };
  return { ...q, service: new ChatService(q.db, storage as unknown as StorageService), storage };
}

const at = new Date("2026-09-28T10:00:00.000Z");
const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  conversationId: "c1",
  senderId: "u2",
  body: "hello",
  createdAt: at,
  editedAt: null,
  deletedAt: null,
  ...over,
});

describe("ChatService.startDm", () => {
  it("won't open a thread with yourself", async () => {
    const { service } = make([]);
    await expect(service.startDm("u1", "u1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("is a 404 for a member who doesn't exist or is suspended", async () => {
    const { service } = make([[]]);
    await expect(service.startDm("u1", "u9")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reuses the pair's thread and makes sure both members are in it", async () => {
    const { service, after, left } = make([[{ id: "u2" }], [{ id: "c1" }], undefined]);
    await expect(service.startDm("u1", "u2")).resolves.toBe("c1");
    expect(after("insert", conversationParticipant, "values")).toEqual([
      { conversationId: "c1", userId: "u1" },
      { conversationId: "c1", userId: "u2" },
    ]);
    expect(left()).toBe(0);
  });

  it("opens a new thread, recording who started it", async () => {
    const { service, after } = make([
      [{ id: "u2" }], // target
      [], // no thread yet
      [{ n: 0 }], // under the daily cap
      [{ id: "c9" }], // created
      undefined, // members added
    ]);
    await expect(service.startDm("u2", "u1")).resolves.toBe("c9");
    expect(after("insert", conversation, "values")).toEqual({
      kind: "dm",
      dmKey: "u1:u2",
      createdBy: "u2",
    });
  });

  it("stops someone opening too many new threads in a day", async () => {
    const { service } = make([[{ id: "u2" }], [], [{ n: MAX_NEW_CONVERSATIONS_PER_DAY }]]);
    const err = await service.startDm("u1", "u2").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
  });
});

describe("ChatService.sendMessage", () => {
  it("is a 404 for a thread you aren't in", async () => {
    const { service } = make([[]]);
    await expect(service.sendMessage("u1", "c1", { body: "hi" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("refuses when the other member has been removed or suspended", async () => {
    const { service } = make([[{ userId: "u1" }], []]);
    await expect(service.sendMessage("u1", "c1", { body: "hi" })).rejects.toThrow(
      "This member is no longer on Kinkord.",
    );
  });

  it("slows down a member sending too fast", async () => {
    const { service } = make([
      [{ userId: "u1" }],
      [{ userId: "u2" }],
      [{ n: MAX_MESSAGES_PER_MINUTE }],
    ]);
    const err = await service.sendMessage("u1", "c1", { body: "hi" }).catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(429);
  });

  it("saves the message, bumps the thread and echoes the client id", async () => {
    const saved = row("m1", { senderId: "u1", body: "hi" });
    const { service, after } = make([
      [{ userId: "u1" }],
      [{ userId: "u2" }],
      [{ n: 0 }],
      [saved],
      undefined,
    ]);
    await expect(
      service.sendMessage("u1", "c1", { body: "hi", clientId: "tmp-1" }),
    ).resolves.toEqual({
      id: "m1",
      conversationId: "c1",
      senderId: "u1",
      body: "hi",
      createdAt: at.toISOString(),
      editedAt: null,
      clientId: "tmp-1",
    });
    expect(after("insert", message, "values")).toEqual({
      conversationId: "c1",
      senderId: "u1",
      body: "hi",
    });
    expect(after("update", conversation, "set")).toEqual({ lastMessageAt: at });
  });
});

describe("ChatService.history", () => {
  it("rejects a cursor from another thread", async () => {
    const { service } = make([[{ userId: "u1" }], []]);
    await expect(
      service.history("u1", "c1", { after: "11111111-1111-4111-8111-111111111111", limit: 50 }),
    ).rejects.toThrow("Unknown message.");
  });

  it("returns the newest page oldest-first", async () => {
    // The database answers newest-first; the thread renders top to bottom.
    const { service } = make([[{ userId: "u1" }], [row("m3"), row("m2"), row("m1")]]);
    const page = await service.history("u1", "c1", { limit: 50 });
    expect(page.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("returns what arrived after a message in order, for polling", async () => {
    const { service } = make([[{ userId: "u1" }], [{ id: "m1" }], [row("m2"), row("m3")]]);
    const page = await service.history("u1", "c1", {
      after: "11111111-1111-4111-8111-111111111111",
      limit: 50,
    });
    expect(page.map((m) => m.id)).toEqual(["m2", "m3"]);
  });
});

describe("ChatService.markRead", () => {
  it("rejects a message from another thread", async () => {
    const { service } = make([[{ userId: "u1" }], []]);
    await expect(service.markRead("u1", "c1", "m9")).rejects.toThrow("Unknown message.");
  });

  it("moves the read pointer to the message", async () => {
    const { service, after } = make([[{ userId: "u1" }], [{ id: "m2" }], undefined]);
    await service.markRead("u1", "c1", "m2");
    expect(after("update", conversationParticipant, "set")).toMatchObject({
      lastReadMessageId: "m2",
    });
  });
});

describe("ChatService.listConversations", () => {
  it("builds each row and leaves out threads with nobody left to answer", async () => {
    const { service } = make([
      [
        { id: "c1", kind: "dm", lastMessageAt: at },
        { id: "c2", kind: "dm", lastMessageAt: at }, // peer suspended or deleted
      ],
      [
        {
          conversationId: "c1",
          userId: "u2",
          username: "ada",
          name: "Adaeze Obi",
          displayName: "Ada",
          avatarKey: "avatars/u2/a.png",
          lastSeenAt: new Date(),
        },
      ],
      [row("m1")],
      [{ conversationId: "c1", unread: 2 }],
    ]);
    const rows = await service.listConversations("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "c1",
      peer: {
        userId: "u2",
        displayName: "Ada",
        avatarUrl: "https://media/avatars/u2/a.png?sm",
        online: true,
      },
      lastMessage: { id: "m1", body: "hello" },
      unreadCount: 2,
    });
  });

  it("is empty without asking for more when there are no threads", async () => {
    const { service, left } = make([[]]);
    await expect(service.listConversations("u1")).resolves.toEqual([]);
    expect(left()).toBe(0);
  });
});

describe("ChatService.conversation", () => {
  it("still returns a thread whose other member has gone, with no peer", async () => {
    const { service } = make([
      [{ userId: "u1" }],
      [{ id: "c1", kind: "dm", lastMessageAt: at }],
      [],
      [],
      [],
    ]);
    await expect(service.conversation("u1", "c1")).resolves.toMatchObject({ id: "c1", peer: null });
  });

  it("is a 404 for a thread you aren't in", async () => {
    const { service } = make([[]]);
    await expect(service.conversation("u1", "c1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
