import { describe, expect, it, vi } from "vitest";
import { alias, PgDialect } from "drizzle-orm/pg-core";
import { staff, user } from "../db/schema";
import { adminUserIds, founderAccount, isAdmin, isBanned, isSuperAdmin, notBanned } from "./admins";

/** A client whose single select resolves to `result`. */
function answering(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select } as never, select };
}

describe("isSuperAdmin", () => {
  it("recognises the founder's verified email, whatever the case or spacing", () => {
    expect(isSuperAdmin({ email: " MaxiHandsome@gmail.com", emailVerified: true })).toBe(true);
  });

  it("recognises the second founder address too", () => {
    expect(isSuperAdmin({ email: "nnabuekassidy@gmail.com", emailVerified: true })).toBe(true);
  });

  it("recognises Tega's account, but only once its email is verified", () => {
    expect(isSuperAdmin({ email: "TegaMaxwell2026@gmail.com", emailVerified: true })).toBe(true);
    expect(isSuperAdmin({ email: "tegamaxwell2026@gmail.com", emailVerified: false })).toBe(false);
  });

  it("refuses the same address until it is verified", () => {
    expect(isSuperAdmin({ email: "maxihandsome@gmail.com", emailVerified: false })).toBe(false);
  });
});

describe("adminUserIds", () => {
  it("lists the founder's verified accounts and the staff, each once", async () => {
    const where = vi.fn(async () => [{ id: "f1" }, { id: "f2" }]);
    const from = vi.fn((table: unknown) =>
      table === staff ? Promise.resolve([{ id: "s1" }, { id: "f1" }]) : { where },
    );
    const db = { select: vi.fn(() => ({ from })) } as never;
    await expect(adminUserIds(db)).resolves.toEqual(["f1", "f2", "s1"]);
    const query = new PgDialect().sqlToQuery((where.mock.calls[0] as unknown[])[0] as never);
    expect(query.sql).toBe(
      '(lower("user"."email") in ($1, $2, $3) and "user"."email_verified" = $4)',
    );
    expect(query.params).toEqual([
      "maxihandsome@gmail.com",
      "nnabuekassidy@gmail.com",
      "tegamaxwell2026@gmail.com",
      true,
    ]);
  });
});

describe("founderAccount", () => {
  it("reads whichever user table it's given, aliases included", () => {
    const u = alias(user, "check_user");
    const query = new PgDialect().sqlToQuery(founderAccount(u));
    expect(query.sql).toBe(
      '(lower("check_user"."email") in ($1, $2, $3) and "check_user"."email_verified" = $4)',
    );
    expect(query.params.at(-1)).toBe(true);
  });
});

describe("isAdmin", () => {
  it("answers for the super admin without asking the database", async () => {
    const { db, select } = answering([]);
    await expect(
      isAdmin(db, { id: "u1", email: "maxihandsome@gmail.com", emailVerified: true }),
    ).resolves.toBe(true);
    expect(select).not.toHaveBeenCalled();
  });

  it("is true with a staff row and false without one", async () => {
    const staffer = { id: "u2", email: "mod@kinkord.test", emailVerified: true };
    await expect(isAdmin(answering([{ userId: "u2" }]).db, staffer)).resolves.toBe(true);
    await expect(isAdmin(answering([]).db, staffer)).resolves.toBe(false);
  });
});

describe("isBanned", () => {
  it("is decided by the ban row", async () => {
    await expect(isBanned(answering([{ userId: "u1" }]).db, "u1")).resolves.toBe(true);
    await expect(isBanned(answering([]).db, "u1")).resolves.toBe(false);
  });
});

describe("notBanned", () => {
  it("excludes any member with a ban row", () => {
    const { sql } = new PgDialect().sqlToQuery(notBanned(user.id));
    expect(sql).toContain('not exists (select 1 from "member_ban"');
    expect(sql).toContain('"member_ban"."user_id" = "user"."id"');
  });
});
