import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushSubscription, pushVapidKey } from "../db/schema";

// Hoisted with the mock, which runs before this file's own top-level code.
const { sendNotification, generateVAPIDKeys } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  generateVAPIDKeys: vi.fn(() => ({ publicKey: "PUB-new", privateKey: "PRIV-new" })),
}));
vi.mock("web-push", () => ({ default: { sendNotification, generateVAPIDKeys } }));

import { PushService } from "./push.service";

/**
 * A stand-in for the Drizzle client: every builder call returns the chain and
 * each `await` takes the next queued answer, so a spec lists the database's
 * replies in the order the code asks.
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
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = calls.findIndex((c) => c.op === anchor && c.args[0] === table);
    return start < 0 ? undefined : calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: chain() as never, calls, after, left: () => queue.length };
}

const KEYS = { publicKey: "PUB", privateKey: "PRIV" };
const sub = (id: string, endpoint = `https://fcm.googleapis.com/fcm/send/${id}`) => ({
  id,
  userId: "u2",
  endpoint,
  p256dh: "p256",
  auth: "auth",
});
// The inbox stores each event and says whether it was new; a null is a repeat
// or a blocked sender, and nothing goes to their devices.
const inboxRecord = vi.fn(async (): Promise<string | null> => "notification-1");
const inboxReadConversation = vi.fn(async () => undefined);
const inbox = () => ({ record: inboxRecord, readConversation: inboxReadConversation }) as never;
beforeEach(() => {
  inboxRecord.mockClear();
  inboxReadConversation.mockClear();
});
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("PushService keys", () => {
  beforeEach(() => generateVAPIDKeys.mockClear());

  it("uses the stored key pair", async () => {
    const { db } = queuedDb([[KEYS]]);
    await expect(new PushService(db, inbox()).publicKey()).resolves.toBe("PUB");
    expect(generateVAPIDKeys).not.toHaveBeenCalled();
  });

  it("makes a pair the first time, and keeps whichever one is stored after a race", async () => {
    const { db, after } = queuedDb([
      [], // none yet
      undefined, // insert ... on conflict do nothing
      [KEYS], // another instance got there first: read back what's stored
    ]);
    await expect(new PushService(db, inbox()).publicKey()).resolves.toBe("PUB");
    expect(after("insert", pushVapidKey, "values")).toEqual({
      id: 1,
      publicKey: "PUB-new",
      privateKey: "PRIV-new",
    });
  });

  it("reads the keys once per process", async () => {
    const { db, left } = queuedDb([[KEYS]]);
    const service = new PushService(db, inbox());
    await service.publicKey();
    await service.publicKey();
    expect(left()).toBe(0);
  });
});

describe("PushService subscriptions", () => {
  it("remembers a device, moving it to whoever signs in on it", async () => {
    const { db, after, calls } = queuedDb([undefined]);
    await new PushService(db, inbox()).subscribe(
      "u1",
      { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } },
      "Chrome",
    );
    expect(after("insert", pushSubscription, "values")).toEqual({
      userId: "u1",
      endpoint: "https://push.example/abc",
      p256dh: "p",
      auth: "a",
      userAgent: "Chrome",
    });
    const upsert = calls.find((c) => c.op === "onConflictDoUpdate")?.args[0] as {
      target: unknown;
      set: Record<string, unknown>;
    };
    expect(upsert.target).toBe(pushSubscription.endpoint);
    expect(upsert.set).toMatchObject({ userId: "u1", p256dh: "p", auth: "a" });
  });
});

describe("PushService sending", () => {
  beforeEach(() => sendNotification.mockReset().mockResolvedValue({ statusCode: 201 }));

  it("sends to each of the member's devices with our VAPID keys", async () => {
    const { db } = queuedDb([[sub("s1"), sub("s2")], [KEYS]]);
    const message = { title: "Kinkord", body: "hi", url: "/home", tag: "t" };
    await expect(new PushService(db, inbox()).sendTo("u2", message)).resolves.toBe(2);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [target, payload, options] = sendNotification.mock.calls[0];
    expect(target).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/s1",
      keys: { p256dh: "p256", auth: "auth" },
    });
    expect(JSON.parse(payload)).toEqual(message);
    expect(options).toMatchObject({
      vapidDetails: { subject: "https://kinkord.com", publicKey: "PUB", privateKey: "PRIV" },
      urgency: "high",
    });
  });

  it("forgets a device the push service says is gone, and keeps the rest", async () => {
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error("Server"), { statusCode: 500 }));
    const { db, calls } = queuedDb([[sub("s1"), sub("s2")], [KEYS], undefined]);
    await expect(
      new PushService(db, inbox()).sendTo("u2", { title: "t", body: "b", url: "/", tag: "t" }),
    ).resolves.toBe(0);
    expect(calls.filter((c) => c.op === "delete")).toHaveLength(1);
  });

  it("asks nothing more when the member has no devices", async () => {
    const { db, left } = queuedDb([[]]);
    await expect(
      new PushService(db, inbox()).sendTo("u2", { title: "t", body: "b", url: "/", tag: "t" }),
    ).resolves.toBe(0);
    expect(left()).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("PushService notifications", () => {
  beforeEach(() => sendNotification.mockReset().mockResolvedValue({ statusCode: 201 }));
  const sent = () => JSON.parse(sendNotification.mock.calls[0][1]);

  it("says who messaged, never what they wrote", async () => {
    const { db } = queuedDb([
      [{ username: "ada", name: "Adaeze", displayName: "Ada" }],
      [sub("s1")],
      [KEYS],
    ]);
    new PushService(db, inbox()).newMessage("u1", "u2", "c1");
    await flush();
    expect(sent()).toEqual({
      title: "Kinkord",
      body: "New message from Ada",
      url: "/messages/c1",
      tag: "chat-c1",
      notificationId: "notification-1",
    });
  });

  it("tells a member who followed them and links to that profile", async () => {
    const { db } = queuedDb([
      [{ username: "raven", name: "Raven", displayName: null }],
      [sub("s1")],
      [KEYS],
    ]);
    new PushService(db, inbox()).newFollower("u1", "u2");
    await flush();
    expect(sent()).toMatchObject({ body: "raven followed you", url: "/u/raven" });
  });

  it("tells an author about a comment, but not about their own", async () => {
    const own = queuedDb([]);
    new PushService(own.db, inbox()).newComment("p1", "u1", "u1");
    await flush();
    expect(own.calls).toHaveLength(0);

    const { db } = queuedDb([
      [{ username: "ada", name: "Adaeze", displayName: "Ada" }],
      [sub("s1")],
      [KEYS],
    ]);
    new PushService(db, inbox()).newComment("p1", "u2", "u1");
    await flush();
    expect(sent()).toMatchObject({ body: "Ada commented on your post", url: "/p/p1" });
  });

  it("pings every moderator about a new report, saying nothing about who or why", async () => {
    const { db } = queuedDb([
      [{ id: "f1" }], // the founder's verified account
      [{ id: "f1" }], // also on staff: still one push
      [sub("s1")],
      [KEYS],
    ]);
    new PushService(db, inbox()).newReport();
    await flush();
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual({
      title: "Kinkord",
      body: "New report to review",
      url: "/moderation/reports",
      tag: "report",
      notificationId: "notification-1",
    });
  });

  it("pings every admin about a payment to verify, saying nothing about whose", async () => {
    const { db } = queuedDb([[{ id: "f1" }], [], [sub("s1")], [KEYS]]);
    new PushService(db, inbox()).newPayment();
    await flush();
    expect(inboxRecord).toHaveBeenCalledWith("f1", { type: "payment" });
    expect(sent()).toEqual({
      title: "Kinkord",
      body: "New payment to verify",
      url: "/moderation/payments",
      tag: "payment",
      notificationId: "notification-1",
    });
  });

  it("asks the admins to look at a Silver check after a profile change", async () => {
    const { db } = queuedDb([[{ id: "f1" }], [], [sub("s1")], [KEYS]]);
    new PushService(db, inbox()).silverCheckReview();
    await flush();
    expect(inboxRecord).toHaveBeenCalledWith("f1", { type: "silver_check" });
    expect(sent()).toMatchObject({
      body: "A Silver badge needs review",
      url: "/moderation/payments",
      tag: "silver_check",
    });
  });

  it("tells a member their payment was confirmed, or wasn't", async () => {
    const verified = queuedDb([[sub("s1")], [KEYS]]);
    new PushService(verified.db, inbox()).paymentVerified("u2", "pay1");
    await flush();
    expect(inboxRecord).toHaveBeenCalledWith("u2", {
      type: "payment_verified",
      subjectId: "pay1",
    });
    expect(sent()).toMatchObject({
      body: "Your Silver Premium is active",
      url: "/subscription",
      tag: "payment-pay1",
    });

    sendNotification.mockClear();
    const rejected = queuedDb([[sub("s1")], [KEYS]]);
    new PushService(rejected.db, inbox()).paymentRejected("u2", "pay2");
    await flush();
    expect(sent()).toMatchObject({
      body: "We couldn't confirm your payment",
      url: "/subscription",
      tag: "payment-pay2",
    });
  });

  it("never throws into the request that caused it", async () => {
    // Once, not a standing implementation: Vitest reports a reset mock's thrown
    // implementation as a failure even when the code catches it.
    sendNotification.mockRejectedValueOnce(new Error("network"));
    const { db } = queuedDb([
      [{ username: "a", name: "a", displayName: "a" }],
      [sub("s1")],
      [KEYS],
    ]);
    expect(() => new PushService(db, inbox()).newMessage("u1", "u2", "c1")).not.toThrow();
    await flush();
  });
});

describe("inbox and push delivery", () => {
  beforeEach(() => sendNotification.mockReset().mockResolvedValue({ statusCode: 201 }));
  const message = { title: "Kinkord", body: "Ada followed you", url: "/u/ada", tag: "follow-u1" };
  const follow = { type: "follow" as const, actorId: "u1" };

  it("stores the event even when the recipient has no push devices", async () => {
    const { db } = queuedDb([[]]);
    await expect(new PushService(db, inbox()).deliver("u2", follow, message)).resolves.toBe(0);
    expect(inboxRecord).toHaveBeenCalledWith("u2", follow);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends nothing the inbox didn't store: a repeat, or a member they've blocked", async () => {
    inboxRecord.mockResolvedValueOnce(null);
    const { db, calls } = queuedDb([]);
    await expect(new PushService(db, inbox()).deliver("u2", follow, message)).resolves.toBe(0);
    expect(calls).toHaveLength(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("keeps one inbox record when delivering to several devices fails", async () => {
    sendNotification
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"));
    const { db } = queuedDb([[sub("s1"), sub("s2")], [KEYS]]);
    await new PushService(db, inbox()).deliver("u2", follow, message);
    expect(inboxRecord).toHaveBeenCalledTimes(1);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it.each(["newLike", "newRepost"] as const)(
    "maps %s to the right inbox event and skips a member's own activity",
    async (method) => {
      const own = queuedDb([]);
      new PushService(own.db, inbox())[method]("p1", "u1", "u1");
      expect(inboxRecord).not.toHaveBeenCalled();
      const { db } = queuedDb([[{ displayName: "Ada" }], []]);
      new PushService(db, inbox())[method]("p1", "u2", "u1");
      await flush();
      expect(inboxRecord).toHaveBeenCalledWith("u2", {
        type: method === "newLike" ? "like" : "repost",
        actorId: "u1",
        subjectId: "p1",
      });
    },
  );

  it("files a message under its chat, at the message's own time", async () => {
    const sentAt = new Date("2026-10-03T10:00:00.000Z");
    const { db } = queuedDb([[{ displayName: "Ada" }], []]);
    new PushService(db, inbox()).newMessage("u1", "u2", "c1", sentAt);
    await flush();
    expect(inboxRecord).toHaveBeenCalledWith("u2", {
      type: "message",
      actorId: "u1",
      subjectId: "c1",
      at: sentAt,
    });
  });

  it("clears a chat's inbox row when the member reads it, without failing the read", async () => {
    inboxReadConversation.mockRejectedValueOnce(new Error("db down"));
    const at = new Date("2026-10-03T10:00:00.000Z");
    expect(() => new PushService(queuedDb([]).db, inbox()).chatRead("u2", "c1", at)).not.toThrow();
    await flush();
    expect(inboxReadConversation).toHaveBeenCalledWith("u2", "c1", at);
  });
});
