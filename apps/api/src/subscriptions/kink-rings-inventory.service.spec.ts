import { expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { KinkRingsInventoryService } from "./kink-rings-inventory.service";
function make(answers: unknown[]) {
  const queue = [...answers];
  const filters: SQL[] = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_t, p) {
        if (p === "then") return (r: (v: unknown) => void) => r(queue.shift());
        return (...args: unknown[]) => {
          if (p === "where") filters.push(args[0] as SQL);
          return chain();
        };
      },
    });
  const storage = { presignDownload: vi.fn(async () => "signed-photo") };
  return {
    service: new KinkRingsInventoryService(chain() as never, storage as never),
    filters,
    storage,
  };
}
it("scopes expired rings to the owner and excludes spent rings", async () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const { service, filters } = make([
    [{ id: "r", createdAt: now, expiresAt: now, paymentId: null }],
    [{ total: 1 }],
  ]);
  const result = await service.expired("owner", 1, now);
  expect(result).toMatchObject({
    total: 1,
    items: [{ source: "award", expiresAt: now.toISOString() }],
    nextPage: null,
  });
  const rendered = new PgDialect().sqlToQuery(filters[0]);
  expect(rendered.params).toContain("owner");
  expect(rendered.sql).toContain('"given_at" is null');
  expect(rendered.sql).toContain('"expires_at" <=');
});
it("reads gifting history with the recipient's current Silver status", async () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const { service, storage } = make([
    [
      {
        id: "r",
        givenAt: now,
        username: "ada",
        name: "Ada",
        avatarKey: null,
        silverEnd: new Date("2026-11-30T12:00:00Z"),
      },
      { id: "old", givenAt: now, username: null, name: null, avatarKey: null, silverEnd: null },
    ],
  ]);
  const result = await service.history("owner", 1, now);
  expect(result.items[0]).toMatchObject({ status: "active", to: { name: "Ada", avatarUrl: null } });
  expect(result.items[1]).toMatchObject({ status: "gifted", to: null });
  expect(storage.presignDownload).not.toHaveBeenCalled();
});
it("does not run a directory query for a too-short search", async () => {
  const { service, filters } = make([]);
  expect(await service.recipients("owner", "search", "@a", 1)).toEqual({
    items: [],
    nextPage: null,
  });
  expect(filters).toHaveLength(0);
});
it("filters friend recipients using accepted friendships, blocks, bans and personal accounts", async () => {
  const { service, filters } = make([[]]);
  await service.recipients("owner", "friends", "", 1);
  const { sql, params } = new PgDialect().sqlToQuery(filters[0]);
  expect(sql).toContain('"friendship"');
  expect(sql).toContain('"member_block"');
  expect(sql).toContain('"member_ban"');
  expect(params).toContain("organization");
  expect(params).toContain("owner");
});
