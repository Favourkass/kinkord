import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { PrivacyRepository } from "./privacy.repository";
import { profilePrivacy } from "../db/schema";
describe("PrivacyRepository", () => {
  it("atomically merges only touched settings and reads the resulting domain record", async () => {
    const saved = { settings: { bio: "friends", location: "country" }, legacy: "public" };
    const limit = vi.fn().mockResolvedValue([saved]);
    const query = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit,
    };
    const conflict = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate: conflict }));
    const db = { select: vi.fn(() => query), insert: vi.fn(() => ({ values })) };
    const repo = new PrivacyRepository(db as never);
    expect(await repo.patch("owner", { bio: "friends" })).toEqual(saved);
    expect(db.insert).toHaveBeenCalledWith(profilePrivacy);
    expect(values).toHaveBeenCalledWith({ userId: "owner", settings: { bio: "friends" } });
    const update = conflict.mock.calls[0][0];
    const rendered = new PgDialect().sqlToQuery(update.set.settings);
    expect(rendered.sql).toContain('"profile_privacy"."settings" ||');
    expect(rendered.params).toEqual(['{"bio":"friends"}']);
  });
  it("returns null for an absent profile", async () => {
    const query = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    expect(
      await new PrivacyRepository({ select: () => query } as never).read("missing"),
    ).toBeNull();
  });
});
