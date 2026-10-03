import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { conversation, conversationParticipant, message } from "../db/schema";
import type { PushService } from "../push/push.service";
import type { RealtimeService } from "../realtime/realtime.service";
import type { StorageService } from "../storage/storage.service";
import { NEW_CHAT_LIMIT } from "./allowance";
import {
  CHAT_PHOTO_MAX_MB,
  ChatService,
  MAX_MESSAGES_PER_MINUTE,
  MAX_NEW_CONVERSATIONS_PER_DAY,
  PHOTOS_LOCKED,
  YOU_BLOCKED,
} from "./chat.service";

/** The SQL of the n-th `.where(...)` the service built, to check what it filters on. */
const whereSql = (calls: Array<{ op: string; args: unknown[] }>, n: number) =>
  new PgDialect().sqlToQuery(calls.filter((c) => c.op === "where")[n].args[0] as SQL).sql;

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
    presignUpload: vi.fn(async (key: string) => `https://upload/${key}`),
    // Every upload exists as a small JPEG unless a spec says otherwise.
    describe: vi.fn(async (): Promise<{ size: number; contentType: string | null } | null> => ({
      size: 1000,
      contentType: "image/jpeg",
    })),
    copy: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
  const realtime = { notify: vi.fn(async () => undefined) };
  const push = { newMessage: vi.fn(), chatRead: vi.fn() };
  return {
    ...q,
    service: new ChatService(
      q.db,
      storage as unknown as StorageService,
      realtime as unknown as RealtimeService,
      push as unknown as PushService,
    ),
    storage,
    realtime,
    push,
  };
}

const at = new Date("2026-09-28T10:00:00.000Z");
/** A signed-in member on the free allowance. */
const member = (id: string) => ({ id, email: `${id}@example.com`, emailVerified: true });
/** A super admin: no daily limits. */
const admin = { id: "a1", email: "maxihandsome@gmail.com", emailVerified: true };
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
    await expect(service.startDm(member("u1"), "u1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("is a 404 for a member who doesn't exist or is suspended", async () => {
    const { service } = make([[]]);
    await expect(service.startDm(member("u1"), "u9")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reuses the pair's thread and makes sure both members are in it", async () => {
    const { service, after, left } = make([[{ id: "u2" }], [{ id: "c1" }], undefined]);
    await expect(service.startDm(member("u1"), "u2")).resolves.toBe("c1");
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
    await expect(service.startDm(member("u2"), "u1")).resolves.toBe("c9");
    expect(after("insert", conversation, "values")).toEqual({
      kind: "dm",
      dmKey: "u1:u2",
      createdBy: "u2",
    });
  });

  it("stops someone opening too many new threads in a day", async () => {
    const { service } = make([[{ id: "u2" }], [], [{ n: MAX_NEW_CONVERSATIONS_PER_DAY }]]);
    const err = await service.startDm(member("u1"), "u2").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
  });

  it("doesn't cap how many threads the super admins open", async () => {
    const { service, left } = make([
      [{ id: "u2" }], // target
      [], // no thread yet
      [{ id: "c9" }], // created, with no count asked first
      undefined, // members added
    ]);
    await expect(service.startDm(admin, "u2")).resolves.toBe("c9");
    expect(left()).toBe(0);
  });
});

describe("ChatService.sendMessage", () => {
  it("is a 404 for a thread you aren't in", async () => {
    const { service } = make([[]]);
    await expect(service.sendMessage(member("u1"), "c1", { body: "hi" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("refuses when the other member has been removed or suspended", async () => {
    const { service } = make([[{ userId: "u1" }], []]);
    await expect(service.sendMessage(member("u1"), "c1", { body: "hi" })).rejects.toThrow(
      "This member is no longer on Kinkord.",
    );
  });

  it("slows down a member sending too fast", async () => {
    const { service } = make([
      [{ userId: "u1" }],
      [{ userId: "u2" }],
      [{ n: MAX_MESSAGES_PER_MINUTE }],
    ]);
    const err = await service
      .sendMessage(member("u1"), "c1", { body: "hi" })
      .catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(429);
  });

  it("saves a reply, bumps the thread and echoes the client id", async () => {
    const saved = row("m1", { senderId: "u1", body: "hi" });
    const { service, after, calls } = make([
      [{ userId: "u1" }], // a member of the thread
      [{ userId: "u2" }], // the other member is still here
      [{ n: 0 }], // not sending too fast
      [{ id: "m0" }], // the thread already has messages: not a new chat
      [saved],
      undefined,
    ]);
    await expect(
      service.sendMessage(member("u1"), "c1", { body: "hi", clientId: "tmp-1" }),
    ).resolves.toEqual({
      id: "m1",
      conversationId: "c1",
      senderId: "u1",
      body: "hi",
      photo: null,
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
    // Replies never take the new-chat lock.
    expect(calls.some((c) => c.op === "execute")).toBe(false);
  });

  it("tells both members' open apps, live, that the thread changed", async () => {
    const saved = row("m1", { senderId: "u1", body: "hi" });
    const { service, realtime } = make([
      [{ userId: "u1" }],
      [{ userId: "u2" }],
      [{ n: 0 }],
      [{ id: "m0" }],
      [saved],
      undefined,
    ]);
    await service.sendMessage(member("u1"), "c1", { body: "hi" });
    expect(realtime.notify).toHaveBeenCalledWith(["u2", "u1"], {
      type: "message",
      conversationId: "c1",
    });
  });

  it("sends the recipient a push notification for a new message", async () => {
    const saved = row("m1", { senderId: "u1", body: "hi" });
    const { service, push } = make([
      [{ userId: "u1" }],
      [{ userId: "u2" }],
      [{ n: 0 }],
      [{ id: "m0" }],
      [saved],
      undefined,
    ]);
    await service.sendMessage(member("u1"), "c1", { body: "hi" });
    // The message's own time travels with it, so reading up to it clears the inbox row.
    expect(push.newMessage).toHaveBeenCalledWith("u1", "u2", "c1", new Date(saved.createdAt));
  });

  it("says nothing live about a message that was refused", async () => {
    const { service, realtime } = make([[{ userId: "u1" }], []]);
    await service.sendMessage(member("u1"), "c1", { body: "hi" }).catch(() => undefined);
    expect(realtime.notify).not.toHaveBeenCalled();
  });

  describe("the daily new-chat allowance", () => {
    it("lets a member start today's new chat", async () => {
      const saved = row("m1", { senderId: "u1", body: "hi" });
      const { service, after, calls, left } = make([
        [{ userId: "u1" }],
        [{ userId: "u2" }],
        [{ n: 0 }],
        [], // nobody has written in this thread yet
        undefined, // the member's new-chat lock
        [{ n: 0 }], // no chats started today
        [saved],
        undefined,
      ]);
      await expect(service.sendMessage(member("u1"), "c1", { body: "hi" })).resolves.toMatchObject({
        id: "m1",
      });
      expect(calls.some((c) => c.op === "execute")).toBe(true);
      expect(after("insert", message, "values")).toEqual({
        conversationId: "c1",
        senderId: "u1",
        body: "hi",
      });
      expect(left()).toBe(0);
    });

    it("refuses a second new chat the same day, saying when it resets", async () => {
      const { service, after } = make([
        [{ userId: "u1" }],
        [{ userId: "u2" }],
        [{ n: 0 }],
        [], // an empty thread: this would be a new chat
        undefined, // lock
        [{ n: 1 }], // today's chat is already used
      ]);
      const err = await service
        .sendMessage(member("u1"), "c1", { body: "hi" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(429);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: NEW_CHAT_LIMIT,
        resetsAt: expect.stringMatching(/T23:00:00\.000Z$/),
      });
      expect(after("insert", message, "values")).toBeUndefined();
    });

    it("doesn't limit the super admins", async () => {
      const saved = row("m1", { senderId: "a1", body: "hi" });
      const { service, calls, left } = make([
        [{ userId: "a1" }],
        [{ userId: "u2" }],
        [{ n: 0 }],
        [saved], // straight to the insert: no emptiness check, no lock
        undefined,
      ]);
      await expect(service.sendMessage(admin, "c1", { body: "hi" })).resolves.toMatchObject({
        id: "m1",
      });
      expect(calls.some((c) => c.op === "execute")).toBe(false);
      expect(left()).toBe(0);
    });
  });
});

describe("ChatService.allowance", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports today's use and when it resets, at Lagos midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T10:00:00Z"));
    const { service } = make([[{ n: 1 }]]);
    await expect(service.allowance(member("u1"))).resolves.toEqual({
      newChatsPerDay: 1,
      usedToday: 1,
      resetsAt: "2026-09-30T23:00:00.000Z",
    });
  });

  it("is unlimited for the super admins, without asking the database", async () => {
    const { service, left } = make([]);
    await expect(service.allowance(admin)).resolves.toEqual({ newChatsPerDay: null });
    expect(left()).toBe(0);
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

  it("moves the read pointer to the message, and clears the chat's inbox row up to it", async () => {
    const { service, after, push } = make([
      [{ userId: "u1" }],
      [{ id: "m2", createdAt: at }],
      undefined,
    ]);
    await service.markRead("u1", "c1", "m2");
    expect(after("update", conversationParticipant, "set")).toMatchObject({
      lastReadMessageId: "m2",
    });
    expect(push.chatRead).toHaveBeenCalledWith("u1", "c1", at);
  });
});

describe("ChatService.listConversations", () => {
  it("builds each row and leaves out threads with nobody left to answer", async () => {
    const { service } = make([
      [
        { id: "c1", kind: "dm", lastMessageAt: at, createdBy: "u2" },
        { id: "c2", kind: "dm", lastMessageAt: at, createdBy: "u1" }, // peer suspended or deleted
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

  it("hides a thread nobody has written in from everyone but whoever opened it", async () => {
    const peer = (conversationId: string, userId: string) => ({
      conversationId,
      userId,
      username: userId,
      name: userId,
      displayName: userId,
      avatarKey: null,
      lastSeenAt: null,
    });
    const { service } = make([
      [
        { id: "c1", kind: "dm", lastMessageAt: at, createdBy: "u2" }, // they opened it, no message yet
        { id: "c3", kind: "dm", lastMessageAt: at, createdBy: "u1" }, // I opened it
      ],
      [peer("c1", "u2"), peer("c3", "u3")],
      [], // no messages in either
      [],
    ]);
    const rows = await service.listConversations("u1");
    expect(rows.map((r) => r.id)).toEqual(["c3"]);
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
    await expect(service.conversation("u1", "c1")).resolves.toMatchObject({
      id: "c1",
      peer: null,
      canSendPhotos: false,
    });
  });

  it("is a 404 for a thread you aren't in", async () => {
    const { service } = make([[]]);
    await expect(service.conversation("u1", "c1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("chat photos", () => {
  const photoKey = "chat/c1/u1/0b5c6c3e-1d0e-4c55-9d4e-3c1f2a9b8e71.jpg";
  /** The database's answers up to the photo check, for u1 replying to u2 in c1. */
  const upToPhoto = [[{ userId: "u1" }], [{ userId: "u2" }], [{ n: 0 }]];
  const peer = {
    conversationId: "c1",
    userId: "u2",
    username: "ada",
    name: "Adaeze Obi",
    displayName: "Ada",
    avatarKey: null,
    lastSeenAt: null,
  };

  describe("upload slots", () => {
    it("are a 404 for a thread you aren't in", async () => {
      const { service } = make([[]]);
      await expect(service.presignPhotoUpload("u1", "c1", "image/jpeg")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("stay shut until the other member has written in the thread", async () => {
      const { service, storage } = make([[{ userId: "u1" }], [{ userId: "u2" }], []]);
      const err = await service.presignPhotoUpload("u1", "c1", "image/jpeg").catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as Error).message).toBe(PHOTOS_LOCKED);
      expect(storage.presignUpload).not.toHaveBeenCalled();
    });

    it("refuse a file that isn't a photo, or is over the size cap", async () => {
      const gif = make([[{ userId: "u1" }], [{ userId: "u2" }], [{ id: "m1" }]]);
      await expect(gif.service.presignPhotoUpload("u1", "c1", "image/gif")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      const huge = make([[{ userId: "u1" }], [{ userId: "u2" }], [{ id: "m1" }]]);
      await expect(
        huge.service.presignPhotoUpload(
          "u1",
          "c1",
          "image/jpeg",
          CHAT_PHOTO_MAX_MB * 1024 * 1024 + 1,
        ),
      ).rejects.toThrow(`max ${CHAT_PHOTO_MAX_MB}MB`);
    });

    it("sit under the uploader's own prefix for this thread, one per stored size", async () => {
      const { service, storage } = make([[{ userId: "u1" }], [{ userId: "u2" }], [{ id: "m1" }]]);
      const slot = await service.presignPhotoUpload("u1", "c1", "image/jpeg", 2048);
      expect(slot.key).toMatch(/^chat\/c1\/u1\/[0-9a-f-]{36}\.jpg$/);
      const base = slot.key.slice(0, -".jpg".length);
      expect(slot).toMatchObject({
        uploadUrl: `https://upload/${slot.key}`,
        variantUploadUrls: {
          sm: `https://upload/${base}_sm.jpg`,
          md: `https://upload/${base}_md.jpg`,
        },
        maxSizeMb: CHAT_PHOTO_MAX_MB,
      });
      // The size the browser declared is signed into the original's slot.
      expect(storage.presignUpload).toHaveBeenCalledWith(slot.key, "image/jpeg", 2048);
    });
  });

  describe("sending", () => {
    it("won't take a photo before the other member has written", async () => {
      const { service, storage, calls } = make([...upToPhoto, []]);
      await expect(
        service.sendMessage(member("u1"), "c1", { body: "", photoKey }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.describe).not.toHaveBeenCalled();
      expect(calls.some((c) => c.op === "insert")).toBe(false);
    });

    it("only accepts a photo the sender uploaded for this thread", async () => {
      for (const key of ["chat/c1/u2/a.jpg", "chat/c9/u1/a.jpg", "posts/u1/a.jpg"]) {
        const { service, storage } = make([...upToPhoto, [{ id: "m0" }]]);
        await expect(
          service.sendMessage(member("u1"), "c1", { body: "", photoKey: key }),
        ).rejects.toThrow("photo: unknown upload");
        expect(storage.describe).not.toHaveBeenCalled();
      }
    });

    it("refuses an upload that isn't there", async () => {
      const { service, storage } = make([...upToPhoto, [{ id: "m0" }]]);
      storage.describe.mockResolvedValueOnce(null);
      await expect(service.sendMessage(member("u1"), "c1", { body: "", photoKey })).rejects.toThrow(
        "photo: upload not found",
      );
    });

    it("deletes and refuses an upload that's too big or isn't a photo", async () => {
      const big = make([...upToPhoto, [{ id: "m0" }]]);
      big.storage.describe.mockResolvedValueOnce({
        size: CHAT_PHOTO_MAX_MB * 1024 * 1024 + 1,
        contentType: "image/jpeg",
      });
      await expect(
        big.service.sendMessage(member("u1"), "c1", { body: "", photoKey }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(big.storage.remove).toHaveBeenCalledWith(photoKey);

      const html = make([...upToPhoto, [{ id: "m0" }]]);
      html.storage.describe.mockResolvedValueOnce({ size: 1000, contentType: "text/html" });
      await expect(
        html.service.sendMessage(member("u1"), "c1", { body: "", photoKey }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(html.storage.remove).toHaveBeenCalledWith(photoKey);
    });

    it("saves the photo with its caption and returns a link to every size", async () => {
      const saved = row("m1", { senderId: "u1", body: "look", photoKey });
      const { service, storage, after } = make([
        ...upToPhoto,
        [{ id: "m0" }], // the other member has written here
        [{ id: "m0" }], // the thread has messages: not a new chat
        [saved],
        undefined,
      ]);
      const sent = await service.sendMessage(member("u1"), "c1", { body: "look", photoKey });
      expect(after("insert", message, "values")).toEqual({
        conversationId: "c1",
        senderId: "u1",
        body: "look",
        photoKey,
      });
      expect(sent.photo).toEqual({
        previewUrl: `https://media/${photoKey}?sm`,
        thumbUrl: `https://media/${photoKey}?md`,
        url: `https://media/${photoKey}?undefined`,
      });
      // Every stored size was already there.
      expect(storage.copy).not.toHaveBeenCalled();
    });

    it("stores a photo sent without a caption with no body", async () => {
      const saved = row("m1", { senderId: "u1", body: null, photoKey });
      const { service, after } = make([
        ...upToPhoto,
        [{ id: "m0" }],
        [{ id: "m0" }],
        [saved],
        undefined,
      ]);
      const sent = await service.sendMessage(member("u1"), "c1", { body: "", photoKey });
      expect(after("insert", message, "values")).toMatchObject({ body: null, photoKey });
      expect(sent.body).toBe("");
    });

    it("fills a stored size the upload is missing by copying the original", async () => {
      const saved = row("m1", { senderId: "u1", body: null, photoKey });
      const { service, storage } = make([
        ...upToPhoto,
        [{ id: "m0" }],
        [{ id: "m0" }],
        [saved],
        undefined,
      ]);
      const small = photoKey.replace(".jpg", "_sm.jpg");
      storage.describe.mockImplementation(async (key?: unknown) =>
        key === small ? null : { size: 1000, contentType: "image/jpeg" },
      );
      await service.sendMessage(member("u1"), "c1", { body: "", photoKey });
      expect(storage.copy).toHaveBeenCalledTimes(1);
      expect(storage.copy).toHaveBeenCalledWith(photoKey, small);
    });
  });

  it("links the photo of a photo message in the thread, and none for text", async () => {
    const theirs = "chat/c1/u2/p.jpg";
    const { service } = make([
      [{ userId: "u1" }],
      [row("m2", { photoKey: theirs, body: null }), row("m1")],
    ]);
    const page = await service.history("u1", "c1", { limit: 50 });
    expect(page.map((m) => [m.id, m.body, m.photo?.thumbUrl ?? null])).toEqual([
      ["m1", "hello", null],
      ["m2", "", `https://media/${theirs}?md`],
    ]);
  });

  describe("the thread header", () => {
    const header = (last: ReturnType<typeof row>) => [
      [{ userId: "u1" }],
      [{ id: "c1", kind: "dm", lastMessageAt: at, createdBy: "u2" }],
      [peer],
      [last],
      [],
    ];

    it("opens photos when the other member wrote last, without asking again", async () => {
      const { service, left } = make(header(row("m1", { senderId: "u2" })));
      await expect(service.conversation("u1", "c1")).resolves.toMatchObject({
        canSendPhotos: true,
      });
      expect(left()).toBe(0);
    });

    it("asks whether the other member ever wrote when the last message is the viewer's", async () => {
      const replied = make([...header(row("m2", { senderId: "u1" })), [{ id: "m1" }]]);
      await expect(replied.service.conversation("u1", "c1")).resolves.toMatchObject({
        canSendPhotos: true,
      });
      const waiting = make([...header(row("m2", { senderId: "u1" })), []]);
      await expect(waiting.service.conversation("u1", "c1")).resolves.toMatchObject({
        canSendPhotos: false,
      });
    });
  });
});

describe("blocks in chat", () => {
  it("won't open a thread with someone who blocked you: they read as gone", async () => {
    const { service, calls } = make([[]]);
    await expect(service.startDm(member("u1"), "u2")).rejects.toBeInstanceOf(NotFoundException);
    expect(whereSql(calls, 0)).toContain(
      'not exists (select 1 from "member_block" where "member_block"."blocker_id" = "user"."id" and "member_block"."blocked_id" = $',
    );
  });

  it("reads as gone to the member who was blocked when they write", async () => {
    // The other member blocked u1, so the writable-peer lookup finds nobody.
    const { service, calls, push } = make([[{ userId: "u1" }], []]);
    await expect(service.sendMessage(member("u1"), "c1", { body: "hi" })).rejects.toThrow(
      "This member is no longer on Kinkord.",
    );
    expect(whereSql(calls, 1)).toContain('"member_block"."blocked_id" = $');
    expect(push.newMessage).not.toHaveBeenCalled();
  });

  it("asks the member who did the blocking to unblock before writing", async () => {
    const { service, calls, push, realtime } = make([
      [{ userId: "u1" }],
      [{ userId: "u2", blockedByMe: true }],
    ]);
    const err = await service.sendMessage(member("u1"), "c1", { body: "hi" }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as Error).message).toBe(YOU_BLOCKED);
    expect(calls.some((c) => c.op === "insert")).toBe(false);
    expect(push.newMessage).not.toHaveBeenCalled();
    expect(realtime.notify).not.toHaveBeenCalled();
  });

  it("hands out no photo upload slot either way round", async () => {
    const blocker = make([[{ userId: "u1" }], [{ userId: "u2", blockedByMe: true }]]);
    await expect(blocker.service.presignPhotoUpload("u1", "c1", "image/jpeg")).rejects.toThrow(
      YOU_BLOCKED,
    );
    const blocked = make([[{ userId: "u1" }], []]);
    await expect(blocked.service.presignPhotoUpload("u1", "c1", "image/jpeg")).rejects.toThrow(
      "This member is no longer on Kinkord.",
    );
    expect(blocked.storage.presignUpload).not.toHaveBeenCalled();
  });

  it("keeps a blocked member's thread for the blocker, flagged, with photos shut", async () => {
    const { service } = make([
      [{ userId: "u1" }],
      [{ id: "c1", kind: "dm", lastMessageAt: at, createdBy: "u2" }],
      [
        {
          conversationId: "c1",
          userId: "u2",
          username: "ada",
          name: "Adaeze Obi",
          displayName: "Ada",
          avatarKey: null,
          lastSeenAt: null,
          blockedByMe: true,
        },
      ],
      [row("m1", { senderId: "u2" })],
      [],
    ]);
    await expect(service.conversation("u1", "c1")).resolves.toMatchObject({
      peer: { userId: "u2", blockedByMe: true },
      canSendPhotos: false,
    });
  });

  it("leaves threads with someone who blocked you out of the inbox", async () => {
    const { service, calls } = make([
      [{ id: "c1", kind: "dm", lastMessageAt: at, createdBy: "u2" }],
      [], // the other member blocked u1: no peer row comes back
      [row("m1", { senderId: "u2" })],
      [],
    ]);
    await expect(service.listConversations("u1")).resolves.toEqual([]);
    expect(whereSql(calls, 1)).toContain(
      '"member_block"."blocker_id" = "conversation_participant"."user_id"',
    );
  });
});
