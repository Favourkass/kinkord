import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  containsPattern,
  NotificationsService,
  notificationUrl,
  RETENTION_DAYS,
  typesMatching,
} from "./notifications.service";

const ID = "00000000-0000-4000-8000-000000000001";
const AT = new Date("2026-10-03T10:00:00.000Z");

/** A row as the inbox query returns it, joined with who did it. */
const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  type: "like" as const,
  actorId: "ada",
  subjectId: "p1",
  count: 1,
  createdAt: AT,
  readAt: null,
  actorUsername: "ada_x",
  actorName: "Ada L",
  actorDisplayName: "Ada",
  actorAvatarKey: "avatars/ada/a.jpg",
  ...over,
});

type Call = { method: string; args: unknown[] };

/**
 * A stand-in database: every chain is recorded call by call, and each one
 * that's awaited (or caught) takes the next queued answer.
 */
function make(answers: unknown[] = []) {
  const queue = [...answers];
  const chains: Call[][] = [];
  const settle = () => Promise.resolve(queue.length ? queue.shift() : []);
  const link = (calls: Call[]): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then")
          return (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) =>
            settle().then(ok, fail);
        if (prop === "catch") return (fail: (e: unknown) => unknown) => settle().catch(fail);
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return link(calls);
        };
      },
    });
  const db = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args: unknown[]) => {
          const calls: Call[] = [{ method: String(method), args }];
          chains.push(calls);
          return link(calls);
        },
    },
  );
  const realtime = { notify: vi.fn(async () => undefined) };
  const storage = { presignDownload: vi.fn(async (key: string) => `https://media.test/${key}`) };
  const service = new NotificationsService(db as never, storage as never, realtime as never);
  const sqlOf = (where: unknown) => new PgDialect().sqlToQuery(where as SQL);
  /** The arguments of the first `method` call in chain `i` (by root method), e.g. "values". */
  const arg = (root: string, method: string, nth = 0) =>
    chains.filter((c) => c[0].method === root)[nth]?.find((c) => c.method === method)?.args[0];
  const has = (root: string, method: string, nth = 0) =>
    Boolean(chains.filter((c) => c[0].method === root)[nth]?.some((c) => c.method === method));
  return { service, chains, realtime, storage, sqlOf, arg, has, left: () => queue.length };
}

describe("NotificationsService.record", () => {
  it("stores an event without any push device and tells the recipient's open apps", async () => {
    const t = make([[], [{ id: ID }]]);
    await expect(
      t.service.record("kemi", { type: "comment", actorId: "ada", subjectId: "p1" }),
    ).resolves.toBe(ID);
    expect(t.arg("insert", "values")).toEqual({
      userId: "kemi",
      type: "comment",
      actorId: "ada",
      subjectId: "p1",
      dedupeKey: null,
    });
    // Every comment counts: no repeat key, so nothing is skipped or merged.
    expect(t.has("insert", "onConflictDoNothing")).toBe(false);
    expect(t.has("insert", "onConflictDoUpdate")).toBe(false);
    expect(t.realtime.notify).toHaveBeenCalledWith(["kemi"], { type: "notification" });
  });

  it("stores nothing for a member's own doing", async () => {
    const t = make();
    await expect(t.service.record("ada", { type: "like", actorId: "ada" })).resolves.toBeNull();
    expect(t.chains).toHaveLength(0);
  });

  it("stores nothing from a member the recipient has blocked", async () => {
    const t = make([[{ blockerId: "kemi" }]]);
    await expect(
      t.service.record("kemi", { type: "like", actorId: "ada", subjectId: "p1" }),
    ).resolves.toBeNull();
    expect(t.chains.map((c) => c[0].method)).toEqual(["select"]);
    expect(t.realtime.notify).not.toHaveBeenCalled();
  });

  it("tells nobody twice when a like, repost or follow is undone and done again", async () => {
    const t = make([[], []]); // not blocked; the insert hits the existing row
    await expect(
      t.service.record("kemi", { type: "like", actorId: "ada", subjectId: "p1" }),
    ).resolves.toBeNull();
    expect(t.arg("insert", "values")).toMatchObject({ dedupeKey: "like:ada:p1" });
    expect(t.has("insert", "onConflictDoNothing")).toBe(true);
    expect(t.realtime.notify).not.toHaveBeenCalled();

    const follow = make([[], [{ id: ID }]]);
    await follow.service.record("kemi", { type: "follow", actorId: "ada" });
    expect(follow.arg("insert", "values")).toMatchObject({ dedupeKey: "follow:ada" });
  });

  it("keeps one row per chat: another message moves it back to the top as unread", async () => {
    const t = make([[], [{ id: ID }]]);
    await t.service.record("kemi", {
      type: "message",
      actorId: "ada",
      subjectId: "c1",
      at: AT,
    });
    expect(t.arg("insert", "values")).toMatchObject({
      dedupeKey: "message:c1",
      createdAt: AT,
    });
    const update = t.arg("insert", "onConflictDoUpdate") as { set: Record<string, unknown> };
    expect(update.set.readAt).toBeNull();
    expect(t.sqlOf(update.set.count).sql).toContain("+ 1 else 1 end");
    expect(t.sqlOf(update.set.createdAt).sql).toContain("greatest(");
  });

  it("sweeps the recipient's read rows past retention, at most every few hours", async () => {
    const t = make([[], [{ id: ID }], [], [], [{ id: ID }]]);
    await t.service.record("kemi", { type: "comment", actorId: "ada", subjectId: "p1" });
    await t.service.record("kemi", { type: "comment", actorId: "ada", subjectId: "p2" });
    const deletes = t.chains.filter((c) => c[0].method === "delete");
    expect(deletes).toHaveLength(1);
    const where = t.sqlOf(deletes[0].find((c) => c.method === "where")!.args[0]);
    expect(where.sql).toContain('"notification"."read_at" <');
    expect(where.sql).toContain(`make_interval(days => ${RETENTION_DAYS})`);
    expect(where.params).toContain("kemi");
  });
});

describe("NotificationsService.list", () => {
  it("shows who did it as they are now, with a signed small avatar and a live link", async () => {
    const t = make([[row({ type: "follow", subjectId: null })]]);
    const { items } = await t.service.list("kemi");
    expect(items[0]).toEqual({
      id: ID,
      type: "follow",
      actor: {
        name: "Ada",
        username: "ada_x",
        avatarUrl: "https://media.test/avatars/ada/a.jpg",
        silver: false,
      },
      url: "/u/ada_x",
      count: 1,
      createdAt: AT.toISOString(),
      readAt: null,
    });
    expect(t.storage.presignDownload).toHaveBeenCalledWith("avatars/ada/a.jpg", "sm");
  });

  it("only lists this member's rows, leaving out blocked and suspended members", async () => {
    const t = make([[]]);
    await t.service.list("kemi", { unreadOnly: true });
    const where = t.sqlOf(t.arg("select", "where"));
    expect(where.params).toContain("kemi");
    expect(where.sql).toContain('"notification"."read_at" is null');
    expect(where.sql).toContain('"member_ban"');
    expect(where.sql).toContain('"member_block"');
    expect(t.arg("select", "limit")).toBe(21);
  });

  it("searches the whole inbox by name or by the kind of activity", async () => {
    const t = make([[]]);
    await t.service.list("kemi", { q: "lik" });
    const where = t.sqlOf(t.arg("select", "where"));
    expect(where.sql).toContain("ilike");
    expect(where.params).toContain("%lik%");
    expect(where.params).toContain("like");
  });

  it("takes a search's own % and _ literally", () => {
    expect(containsPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });

  it("uses both time and id in the cursor, so same-time rows are not skipped", async () => {
    const rows = Array.from({ length: 21 }, (_, i) =>
      row({ id: `00000000-0000-4000-8000-${String(100 - i).padStart(12, "0")}` }),
    );
    const first = make([rows]);
    const page = await first.service.list("kemi");
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).not.toBeNull();

    const next = make([[]]);
    await next.service.list("kemi", { cursor: page.nextCursor! });
    const where = next.sqlOf(next.arg("select", "where"));
    expect(where.params).toContain(rows[19].id);
    expect(where.sql).toContain('"notification"."id" <');
  });

  it("rejects a malformed cursor before querying", async () => {
    const t = make();
    await expect(t.service.list("kemi", { cursor: "invalid" })).rejects.toThrow(
      "Invalid notification cursor",
    );
    expect(t.chains).toHaveLength(0);
  });
});

describe("NotificationsService reading", () => {
  it("counts only this member's unread rows that are still shown", async () => {
    const t = make([[{ total: 3 }]]);
    await expect(t.service.unreadCount("kemi")).resolves.toEqual({ count: 3 });
    const where = t.sqlOf(t.arg("select", "where"));
    expect(where.sql).toContain('"notification"."read_at" is null');
    expect(where.sql).toContain('"member_block"');
  });

  it("marks only an owned unread row, returns it, and tells their other devices", async () => {
    const t = make([[{ id: ID }], [row({ readAt: AT })]]);
    await expect(t.service.read("kemi", ID)).resolves.toMatchObject({
      id: ID,
      readAt: AT.toISOString(),
      actor: { name: "Ada" },
    });
    const where = t.sqlOf(t.arg("update", "where"));
    expect(where.params).toEqual([ID, "kemi"]);
    expect(where.sql).toContain('"notification"."read_at" is null');
    expect(t.realtime.notify).toHaveBeenCalledWith(["kemi"], { type: "notification" });
  });

  it("keeps the first read time when opened again, and stays quiet", async () => {
    const t = make([[], [row({ readAt: AT })]]);
    await t.service.read("kemi", ID);
    expect(t.realtime.notify).not.toHaveBeenCalled();
  });

  it("does not expose another member's row", async () => {
    const t = make([[], []]);
    await expect(t.service.read("intruder", ID)).rejects.toThrow("Notification not found");
    for (const chain of t.chains) {
      const where = chain.find((c) => c.method === "where")!.args[0];
      expect(t.sqlOf(where).params).toContain("intruder");
    }
  });

  it("marks all of this member's unread rows", async () => {
    const t = make([[{ id: ID }]]);
    await expect(t.service.readAll("kemi")).resolves.toEqual({ ok: true });
    expect(t.sqlOf(t.arg("update", "where")).params).toEqual(["kemi", "message"]);
    expect(t.realtime.notify).toHaveBeenCalledTimes(1);
  });

  it("clears a chat's row once it's read up to the latest message, not before", async () => {
    const t = make([[{ id: ID }]]);
    await t.service.readConversation("kemi", "c1", AT);
    const where = t.sqlOf(t.arg("update", "where"));
    expect(where.params).toEqual(["kemi", "message:c1", AT.toISOString()]);
    expect(where.sql).toContain('"notification"."created_at" <=');
    expect(t.realtime.notify).toHaveBeenCalledWith(["kemi"], { type: "notification" });
  });
});

describe("notification links and search words", () => {
  it("links each kind of notification to the right screen", () => {
    expect(notificationUrl("message", "c1", null)).toBe("/messages/c1");
    expect(notificationUrl("follow", null, "ada x")).toBe("/u/ada%20x");
    expect(notificationUrl("follow", null, null)).toBe("/notifications");
    expect(notificationUrl("like", "p1", "ada")).toBe("/p/p1");
    expect(notificationUrl("report", null, null)).toBe("/moderation/reports");
    expect(notificationUrl("verification", null, null)).toBe("/moderation/verification");
    expect(notificationUrl("test", null, null)).toBe("/settings");
    expect(notificationUrl("payment", null, null)).toBe("/moderation/payments");
    expect(notificationUrl("silver_check", null, null)).toBe("/moderation/payments");
    expect(notificationUrl("payment_verified", "pay1", null)).toBe("/subscription");
    expect(notificationUrl("payment_rejected", "pay1", null)).toBe("/subscription");
  });

  it("finds kinds of activity by the start of their words, ignoring one-letter searches", () => {
    expect(typesMatching("Liked")).toEqual(["like"]);
    expect(typesMatching("rep")).toEqual(["repost", "report"]);
    expect(typesMatching("a")).toEqual([]);
    expect(typesMatching("silver")).toEqual([
      "payment_verified",
      "payment_rejected",
      "silver_check",
    ]);
  });
});

describe("notification menu and category totals", () => {
  it("counts all pages and excludes message alerts from category totals", async () => {
    const t = make([[{ all: "8", comment: "2", mention: "3" }]]);
    expect(await t.service.counts("kemi", true)).toEqual({ all: 8, comment: 2, mention: 3 });
    const where = t.sqlOf(t.arg("select", "where"));
    expect(where.params).toContain("kemi");
    expect(where.params).toContain("message");
    expect(where.sql).toContain('"read_at" is null');
  });
  it("deletes only the owned row and notifies other devices", async () => {
    const t = make([[{ id: ID }]]);
    expect(await t.service.delete("kemi", ID)).toEqual({ id: ID });
    expect(t.sqlOf(t.arg("delete", "where")).params).toEqual(["kemi", ID]);
    expect(t.realtime.notify).toHaveBeenCalledWith(["kemi"], { type: "notification" });
    await expect(make([[]]).service.delete("intruder", ID)).rejects.toThrow(
      "Notification not found",
    );
  });
});

it("still opens a message push even though messages are hidden from the inbox", async () => {
  const t = make([[{ id: ID }], [row({ type: "message", subjectId: "c1" })]]);
  const item = await t.service.read("kemi", ID);
  expect(item.url).toBe("/messages/c1");
  const where = t.sqlOf(t.arg("select", "where"));
  expect(where.sql).not.toContain('"notification"."type" <>');
});
