import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { NotificationsService } from "./notifications.service";

const ID = "00000000-0000-4000-8000-000000000001";
const AT = new Date("2026-10-03T10:00:00.000Z");
const row = (id = ID) => ({
  id,
  userId: "member",
  type: "message" as const,
  title: "Kinkord",
  body: "New message from Ada",
  url: "/messages/thread",
  createdAt: AT,
  readAt: null,
});

function make(answers: unknown[] = []) {
  const queue = [...answers];
  const wheres: SQL[] = [];
  const values: unknown[] = [];
  const limits: number[] = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then")
          return (resolve: (value: unknown) => void) => resolve(queue.shift() ?? []);
        return (...args: unknown[]) => {
          if (prop === "where") wheres.push(args[0] as SQL);
          if (prop === "values") values.push(args[0]);
          if (prop === "limit") limits.push(args[0] as number);
          return chain();
        };
      },
    });
  return {
    service: new NotificationsService(
      chain() as never,
      { presignDownload: vi.fn().mockResolvedValue("https://media.test/avatar_sm.jpg") } as never,
    ),
    values,
    limits,
    queries: () => wheres.map((where) => new PgDialect().sqlToQuery(where)),
  };
}

describe("NotificationsService", () => {
  it("persists an inbox item without a browser subscription", async () => {
    const { service, values } = make([[{ id: ID }]]);
    const message = {
      type: "message" as const,
      title: "Kinkord",
      body: "New message from Ada",
      url: "/messages/thread",
    };
    await expect(service.create("member", message)).resolves.toBe(ID);
    expect(values).toEqual([{ userId: "member", ...message }]);
  });

  it("lists only this member's items, optionally unread, with a bounded page", async () => {
    const { service, queries, limits } = make([[row()]]);
    const result = await service.list("member", undefined, true);
    expect(result.items[0]).toMatchObject({ id: ID, readAt: null, createdAt: AT.toISOString() });
    expect(result.items[0]).not.toHaveProperty("userId");
    expect(limits).toEqual([21]);
    expect(queries()[0].params).toContain("member");
    expect(queries()[0].sql).toContain('"notification"."read_at" is null');
  });

  it("filters categories before pagination", async () => {
    const { service, queries } = make();
    await service.list("member", undefined, false, "comment");
    expect(queries()[0].params).toEqual(["member", "comment"]);
  });
  it("uses both time and id in the cursor so same-time events are not skipped", async () => {
    const rows = Array.from({ length: 21 }, (_, i) =>
      row(`00000000-0000-4000-8000-${String(100 - i).padStart(12, "0")}`),
    );
    const first = make([rows]);
    const result = await first.service.list("member");
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
    const next = make([[]]);
    await next.service.list("member", result.nextCursor!);
    expect(next.queries()[0].params).toContain(rows[19].id);
    expect(next.queries()[0].sql).toContain('"notification"."id" <');
  });

  it("rejects malformed cursors before querying the database", async () => {
    await expect(make().service.list("member", "invalid")).rejects.toThrow(
      "Invalid notification cursor",
    );
  });

  it("returns the actor name and a signed small avatar without exposing storage keys", async () => {
    const { service } = make([
      [{ ...row(), actor: { name: "Ada", avatarKey: "avatars/ada.jpg" } }],
    ]);
    const result = await service.list("member");
    expect(result.items[0].actor).toEqual({
      name: "Ada",
      avatarUrl: "https://media.test/avatar_sm.jpg",
    });
    expect(JSON.stringify(result)).not.toContain("avatarKey");
  });

  it("counts only this member's unread items", async () => {
    const { service, queries } = make([[{ total: 3 }]]);
    await expect(service.unreadCount("member")).resolves.toEqual({ count: 3 });
    expect(queries()[0].params).toEqual(["member"]);
    expect(queries()[0].sql).toContain('"notification"."read_at" is null');
  });

  it("marks only an owned unread item and returns the persisted state", async () => {
    const readAt = new Date("2026-10-03T10:01:00Z");
    const { service, queries } = make([[{ ...row(), readAt }]]);
    await expect(service.read("member", ID)).resolves.toMatchObject({
      readAt: readAt.toISOString(),
    });
    expect(queries()[0].params).toEqual([ID, "member"]);
    expect(queries()[0].sql).toContain('"notification"."read_at" is null');
  });

  it("preserves the first read timestamp when opened again", async () => {
    const readAt = new Date("2026-10-03T10:01:00Z");
    const { service, queries } = make([[], [{ ...row(), readAt }]]);
    await expect(service.read("member", ID)).resolves.toMatchObject({
      readAt: readAt.toISOString(),
    });
    expect(queries()[1].params).toEqual([ID, "member"]);
  });

  it("does not expose or mark another member's item", async () => {
    const { service, queries } = make([[], []]);
    await expect(service.read("intruder", ID)).rejects.toThrow("Notification not found");
    for (const query of queries()) expect(query.params).toContain("intruder");
  });

  it("mark all touches only this member's unread items", async () => {
    const { service, queries } = make();
    await expect(service.readAll("member")).resolves.toEqual({ ok: true });
    expect(queries()[0].params).toEqual(["member"]);
    expect(queries()[0].sql).toContain('"notification"."read_at" is null');
  });
});
