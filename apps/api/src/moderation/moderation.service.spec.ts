import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import type { BronzeService } from "../verification/bronze.service";
import { describe, expect, it, vi } from "vitest";
import {
  memberBan,
  memberSubscription,
  moderationLog,
  profile,
  session,
  signupBlock,
  staff,
  user,
} from "../db/schema";
import type { PostsService } from "../posts/posts.service";
import type { StorageService } from "../storage/storage.service";
import { FOUNDER_SILVER_UNTIL } from "../subscriptions/plans";
import { containsPattern, ModerationService, normalizeRuleValue } from "./moderation.service";

/**
 * A stand-in for the Drizzle client. Every builder call returns the chain, and
 * each `await` takes the next queued answer, so a spec lists the database's
 * replies in the order the code asks and then checks what was written.
 * `transaction(fn)` runs `fn` on the same stub, so its queries queue in line.
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
        if (prop === "transaction") return (fn: (tx: unknown) => unknown) => fn(db);
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  const db = chain();
  const indexOf = (op: string, table: unknown) =>
    calls.findIndex((c) => c.op === op && c.args[0] === table);
  /** The argument `op` received next after `anchor` was called on `table`. */
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = indexOf(anchor, table);
    return start < 0 ? undefined : calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: db as never, calls, indexOf, after, left: () => queue.length };
}

function make(answers: unknown[]) {
  const q = queuedDb(answers);
  const storage = {
    presignDownload: vi.fn(async (key: string, variant?: string) =>
      variant ? `https://media/${key}?${variant}` : `https://media/${key}`,
    ),
    remove: vi.fn(async () => undefined),
  };
  const posts = {
    removeAsModerator: vi.fn(async (id: string) => ({ deleted: id, authorId: "u9" })),
  };
  const verification = { forgetMember: vi.fn(async () => undefined) };
  const service = new ModerationService(
    q.db,
    storage as unknown as StorageService,
    posts as unknown as PostsService,
    verification as unknown as BronzeService,
  );
  return { ...q, service, storage, posts, verification };
}

const member = {
  id: "u9",
  email: "C.Tolulope05@gmail.com",
  emailVerified: true,
  username: "downtoearth",
};

describe("ModerationService guard rails", () => {
  it("won't let an admin block their own account", async () => {
    const { service } = make([]);
    await expect(service.block("u1", "u1", {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("won't block or delete the super admin", async () => {
    const founder = { ...member, id: "u1", email: "maxihandsome@gmail.com" };
    const { service } = make([[founder], [founder]]);
    await expect(service.block("u2", "u1", {})).rejects.toThrow(/Admins can't/);
    await expect(service.deleteMember("u2", "u1", {})).rejects.toThrow(/Admins can't/);
  });
});

describe("ModerationService.block", () => {
  it("suspends, signs out everywhere, writes the rules and can take the posts too", async () => {
    const { service, after, calls, posts } = make([
      [member], // the target
      [], // no staff row
      [{ ip: "102.89.84.23" }, { ip: null }], // where they signed in from
      [{ phone: "+2349054291043", verified: true }], // their profile's phone
      undefined, // ban row
      undefined, // sessions deleted
      undefined, // rules
      [{ id: "p1" }, { id: "p2" }], // their live posts
      undefined, // log
    ]);

    await expect(
      service.block("admin1", "u9", { reason: " harassment ", deletePosts: true }),
    ).resolves.toEqual({ blocked: "u9", postsRemoved: 2 });

    expect(after("insert", memberBan, "values")).toEqual({
      userId: "u9",
      reason: "harassment",
      bannedBy: "admin1",
    });
    expect(calls.some((c) => c.op === "delete" && c.args[0] === session)).toBe(true);
    const rules = after("insert", signupBlock, "values") as Array<Record<string, string>>;
    expect(rules.map((r) => `${r.kind}:${r.value}:${r.action}`)).toEqual([
      "email:ctolulope05@gmail.com:block",
      "phone:+2349054291043:block",
      "ip:102.89.84.23:flag",
    ]);
    expect(rules.every((r) => r.subjectUserId === "u9" && r.reason === "harassment")).toBe(true);
    expect(posts.removeAsModerator.mock.calls.map((c) => c[0])).toEqual(["p1", "p2"]);
    expect(after("insert", moderationLog, "values")).toMatchObject({
      actorId: "admin1",
      action: "block",
      subjectUserId: "u9",
    });
  });

  it("never bans a phone the member didn't verify: it may be someone else's", async () => {
    const { service, after } = make([
      [member],
      [],
      [{ ip: "102.89.84.23" }],
      [{ phone: "+2348035550142", verified: false }], // typed in, never proved
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    await service.block("admin1", "u9", {});
    const rules = after("insert", signupBlock, "values") as Array<Record<string, string>>;
    expect(rules.map((r) => `${r.kind}:${r.value}`)).toEqual([
      "email:ctolulope05@gmail.com",
      "ip:102.89.84.23",
    ]);
  });

  it("leaves the posts alone unless asked", async () => {
    const { service, posts } = make([
      [member],
      [],
      [],
      [],
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    await expect(service.block("admin1", "u9", {})).resolves.toEqual({
      blocked: "u9",
      postsRemoved: 0,
    });
    expect(posts.removeAsModerator).not.toHaveBeenCalled();
  });
});

describe("ModerationService.unblock", () => {
  it("lifts the ban and every rule written for that member", async () => {
    const { service, calls } = make([[{ id: "u9" }], undefined, undefined, undefined]);
    await service.unblock("admin1", "u9");
    const deleted = calls.filter((c) => c.op === "delete").map((c) => c.args[0]);
    expect(deleted).toEqual([memberBan, signupBlock]);
  });
});

describe("ModerationService.deleteMember", () => {
  it("clears their files, blocks them from returning, then deletes the account", async () => {
    const target = { ...member, email: "x@y.com", emailVerified: false };
    const { service, storage, indexOf, after, verification } = make([
      [target],
      [],
      [], // no IPs
      [], // no phone on their profile
      undefined, // rules
      [{ key: "posts/u9/a.jpg", posterKey: null }],
      [{ key: "avatars/u9/b.png" }],
      [{ avatarKey: "avatars/u9/b.png", coverKey: "covers/u9/c.png" }],
      undefined, // user deleted
      undefined, // log
    ]);

    await expect(service.deleteMember("admin1", "u9", { block: true })).resolves.toEqual({
      deleted: "u9",
    });

    const removed = storage.remove.mock.calls.map((c) => c[0]).sort();
    expect(removed).toEqual(
      [
        "avatars/u9/b.png",
        "avatars/u9/b_md.png",
        "avatars/u9/b_sm.png",
        "covers/u9/c.png",
        "covers/u9/c_md.png",
        "covers/u9/c_sm.png",
        "posts/u9/a.jpg",
        "posts/u9/a_md.jpg",
        "posts/u9/a_sm.jpg",
      ].sort(),
    );
    // What Didit holds is durably queued while the account still exists to find it by.
    // A ban also holds their identity, so it can't verify a new account unseen.
    expect(verification.forgetMember).toHaveBeenCalledWith("u9", { hold: true });
    // The rules are written while the account still exists to read them from.
    expect(indexOf("insert", signupBlock)).toBeLessThan(indexOf("delete", user));
    expect(after("insert", moderationLog, "values")).toMatchObject({
      action: "delete+block",
      detail: "@downtoearth x@y.com",
    });
  });

  it("keeps the account when durable provider-erasure queuing fails", async () => {
    const { service, verification, indexOf } = make([[member], []]);
    verification.forgetMember.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(service.deleteMember("admin1", "u9", {})).rejects.toThrow("database unavailable");
    expect(indexOf("delete", user)).toBe(-1);
  });
});

describe("ModerationService.deletePost", () => {
  it("removes the post and records whose it was", async () => {
    const { service, after, posts } = make([undefined]);
    await expect(service.deletePost("admin1", "p1")).resolves.toEqual({ deleted: "p1" });
    expect(posts.removeAsModerator).toHaveBeenCalledWith("p1");
    expect(after("insert", moderationLog, "values")).toMatchObject({
      action: "delete-post",
      subjectUserId: "u9",
      subjectPostId: "p1",
    });
  });
});

describe("ModerationService.addRule", () => {
  it("stores the value normalised, so it matches however it was pasted", async () => {
    const row = {
      id: "r1",
      kind: "email",
      value: "ctolulope05@gmail.com",
      action: "block",
      reason: null,
      subjectUserId: null,
      createdAt: new Date("2026-09-28T08:00:00Z"),
    };
    const { service, after } = make([[row], undefined]);
    const rule = await service.addRule("admin1", {
      kind: "email",
      value: "C.Tolulope05+again@gmail.com",
      action: "block",
    });
    expect(after("insert", signupBlock, "values")).toMatchObject({
      value: "ctolulope05@gmail.com",
    });
    expect(rule.createdAt).toBe("2026-09-28T08:00:00.000Z");
  });
});

describe("ModerationService.searchMembers", () => {
  it("shapes each row for the admin list", async () => {
    const { service } = make([
      [
        {
          id: "u1",
          name: "Favour",
          username: "favour",
          email: "maxihandsome@gmail.com",
          emailVerified: true,
          createdAt: new Date("2026-08-20T10:00:00Z"),
          displayName: "Favour",
          phone: "+2348000000001",
          avatarKey: "avatars/u1/a.png",
          lastSeenAt: null,
          posts: "3",
          banned: false,
          staff: false,
        },
      ],
    ]);
    const [row] = await service.searchMembers("fav");
    expect(row).toMatchObject({
      id: "u1",
      posts: 3,
      banned: false,
      admin: true,
      avatarUrl: "https://media/avatars/u1/a.png?sm",
      createdAt: "2026-08-20T10:00:00.000Z",
    });
  });
});

describe("ModerationService.isAdmin", () => {
  it("recognises the super admin", async () => {
    const { service } = make([]);
    await expect(
      service.isAdmin({ id: "u1", email: "maxihandsome@gmail.com", emailVerified: true }),
    ).resolves.toBe(true);
  });
});

/** A row of the admin list query, for someone who isn't a founder. */
const teammate = {
  id: "u7",
  name: "Jane Doe",
  username: "ladyjane",
  email: "jane@example.com",
  emailVerified: true,
  displayName: "Lady Jane",
  avatarKey: "avatars/u7/a.png",
  since: null as Date | null,
  silverEnd: null as Date | null,
  silverGivenBy: null as string | null,
};

describe("ModerationService.team", () => {
  it("lists the founders first, then the admins they made", async () => {
    const founder = {
      ...teammate,
      id: "u1",
      name: "Favour",
      username: "favour",
      email: "maxihandsome@gmail.com",
      displayName: null,
      avatarKey: null,
      silverEnd: FOUNDER_SILVER_UNTIL,
    };
    const since = new Date("2026-10-10T09:00:00Z");
    const { service } = make([[{ ...teammate, since }, founder]]);
    await expect(service.team()).resolves.toEqual([
      {
        id: "u1",
        name: "Favour",
        displayName: null,
        username: "favour",
        avatarUrl: null,
        founder: true,
        since: null,
        silver: "founder",
        silverUntil: null,
      },
      {
        id: "u7",
        name: "Jane Doe",
        displayName: "Lady Jane",
        username: "ladyjane",
        avatarUrl: "https://media/avatars/u7/a.png?sm",
        founder: false,
        since: "2026-10-10T09:00:00.000Z",
        silver: null,
        silverUntil: null,
      },
    ]);
  });

  it("tells Silver the founders gave from Silver an admin paid for", async () => {
    const paidEnd = new Date("2026-11-06T12:00:00Z");
    const { service } = make([
      [
        { ...teammate, silverEnd: FOUNDER_SILVER_UNTIL, silverGivenBy: "u1" },
        { ...teammate, id: "u8", silverEnd: paidEnd },
        // Silver for good set by hand, before there was a button: the founders' too.
        { ...teammate, id: "u9", silverEnd: FOUNDER_SILVER_UNTIL },
      ],
    ]);
    const team = await service.team();
    expect(team.map((a) => [a.id, a.silver, a.silverUntil])).toEqual([
      ["u7", "given", null],
      ["u8", "paid", "2026-11-06T12:00:00.000Z"],
      ["u9", "given", null],
    ]);
  });
});

describe("ModerationService.addAdmin", () => {
  const since = new Date("2026-10-10T09:00:00Z");

  it("finds the member by username however it was typed, and logs who made them an admin", async () => {
    const { service, calls, after } = make([[teammate], [], [{ since }], undefined]);
    const added = await service.addAdmin("u1", " @LadyJane ");
    const lookup = calls.find((c) => c.op === "where")?.args[0];
    expect(new PgDialect().sqlToQuery(lookup as never).params).toEqual(["ladyjane"]);
    expect(after("insert", staff, "values")).toEqual({ userId: "u7" });
    expect(after("insert", moderationLog, "values")).toMatchObject({
      actorId: "u1",
      action: "add-admin",
      subjectUserId: "u7",
      detail: "@ladyjane",
    });
    expect(added).toMatchObject({ id: "u7", founder: false, since: "2026-10-10T09:00:00.000Z" });
  });

  it("says when no member has that username", async () => {
    const { service, indexOf } = make([[]]);
    await expect(service.addAdmin("u1", "ladyjayne")).rejects.toThrow(
      new NotFoundException("No member has the username @ladyjayne."),
    );
    expect(indexOf("insert", staff)).toBe(-1);
  });

  it("won't make a blocked member an admin", async () => {
    const { service, indexOf } = make([[teammate], [{ userId: "u7" }]]);
    await expect(service.addAdmin("u1", "ladyjane")).rejects.toBeInstanceOf(ConflictException);
    expect(indexOf("insert", staff)).toBe(-1);
  });

  it("changes nothing for someone who's already an admin", async () => {
    const { service, indexOf } = make([[{ ...teammate, since }], []]);
    await expect(service.addAdmin("u1", "ladyjane")).resolves.toMatchObject({
      id: "u7",
      since: "2026-10-10T09:00:00.000Z",
    });
    expect(indexOf("insert", staff)).toBe(-1);
    expect(indexOf("insert", moderationLog)).toBe(-1);
  });

  it("writes no row for a founder, who is an admin by their email", async () => {
    const founder = { ...teammate, id: "u1", email: "maxihandsome@gmail.com" };
    const { service, indexOf } = make([[founder], []]);
    await expect(service.addAdmin("u2", "ladyjane")).resolves.toMatchObject({
      founder: true,
      since: null,
    });
    expect(indexOf("insert", staff)).toBe(-1);
  });
});

describe("ModerationService.removeAdmin", () => {
  it("deletes their admin row and logs who removed them", async () => {
    const { service, indexOf, after, left } = make([
      [teammate],
      [{ userId: "u7" }],
      [], // no Silver to take back
      undefined,
    ]);
    await expect(service.removeAdmin("u1", "u7")).resolves.toEqual({ removed: "u7" });
    expect(indexOf("delete", staff)).toBeGreaterThan(-1);
    expect(indexOf("update", memberSubscription)).toBe(-1);
    expect(after("insert", moderationLog, "values")).toMatchObject({
      actorId: "u1",
      action: "remove-admin",
      subjectUserId: "u7",
      detail: "@ladyjane",
    });
    expect(left()).toBe(0);
  });

  it("takes back the Silver the founders gave with the role, and logs that too", async () => {
    const { service, calls, after, left } = make([
      [teammate],
      [{ userId: "u7" }],
      [{ end: FOUNDER_SILVER_UNTIL, grantedBy: "u1", paidUntil: null }],
      undefined,
      undefined,
      undefined,
    ]);
    await service.removeAdmin("u2", "u7");
    expect(after("update", memberSubscription, "set")).toMatchObject({
      grantedBy: null,
      paidUntil: null,
    });
    const logged = calls
      .filter((c) => c.op === "values" && (c.args[0] as { action?: string }).action)
      .map((c) => (c.args[0] as { action: string }).action);
    expect(logged).toEqual(["remove-admin", "remove-silver"]);
    expect(left()).toBe(0);
  });

  it("can't remove a founder", async () => {
    const founder = { ...teammate, email: "nnabuekassidy@gmail.com" };
    const { service, indexOf } = make([[founder]]);
    await expect(service.removeAdmin("u1", "u7")).rejects.toBeInstanceOf(ForbiddenException);
    expect(indexOf("delete", staff)).toBe(-1);
  });

  it("says when the member isn't an admin, and logs nothing", async () => {
    const { service, indexOf } = make([[teammate], []]);
    await expect(service.removeAdmin("u1", "u7")).rejects.toBeInstanceOf(NotFoundException);
    expect(indexOf("insert", moderationLog)).toBe(-1);
  });
});

describe("helpers", () => {
  it("treats % and _ in a search as literal characters", () => {
    expect(containsPattern("tolu_99%")).toBe("%tolu\\_99\\%%");
  });

  it("normalises each kind of rule the way the sign-up check will read it", () => {
    expect(normalizeRuleValue("phone", "0905 429 1043")).toBe("+2349054291043");
    expect(normalizeRuleValue("ip", "::ffff:102.93.7.171")).toBe("102.93.7.171");
    expect(normalizeRuleValue("name", "  Durowara ")).toBe("durowara");
  });
});

describe("ModerationService team badge", () => {
  for (const enabled of [true, false])
    it(`sets badge to ${enabled} and audits without changing permissions or subscriptions`, async () => {
      const set = vi.fn().mockReturnThis();
      const where = vi.fn().mockReturnThis();
      const returning = vi.fn().mockResolvedValue([{ teamMember: enabled }]);
      const values = vi.fn().mockResolvedValue(undefined);
      const tx = {
        update: vi.fn(() => ({ set, where, returning })),
        insert: vi.fn(() => ({ values })),
      };
      const transaction = vi.fn((fn) => fn(tx));
      const service = new ModerationService(
        { transaction } as never,
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(service.setTeamBadge("admin", "person", enabled)).resolves.toEqual({
        teamMember: enabled,
      });
      expect(tx.update).toHaveBeenCalledExactlyOnceWith(profile);
      expect(set).toHaveBeenCalledWith({ teamMember: enabled });
      expect(tx.insert).toHaveBeenCalledExactlyOnceWith(moderationLog);
      expect(values).toHaveBeenCalledWith({
        actorId: "admin",
        subjectUserId: "person",
        action: enabled ? "assign-team-badge" : "remove-team-badge",
      });
    });
  it("refuses a missing profile without writing an audit success", async () => {
    const q = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    const tx = { update: vi.fn(() => q), insert: vi.fn() };
    const service = new ModerationService(
      { transaction: (fn: (value: typeof tx) => unknown) => fn(tx) } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.setTeamBadge("admin", "absent", true)).rejects.toThrow(NotFoundException);
    expect(tx.insert).not.toHaveBeenCalled();
  });
});

describe("ModerationService.setAdminSilver", () => {
  const adminRow = {
    email: "jane@example.com",
    emailVerified: true,
    username: "ladyjane",
    admin: "u7",
  };
  const since = new Date("2026-10-10T09:00:00Z");

  it("gives an admin Silver for good, logs which founder did, and returns their row", async () => {
    const { service, after, left } = make([
      [adminRow],
      [], // not on Silver yet
      undefined,
      undefined,
      [{ ...teammate, since, silverEnd: FOUNDER_SILVER_UNTIL, silverGivenBy: "u1" }],
    ]);
    await expect(service.setAdminSilver("u1", "u7", true)).resolves.toMatchObject({
      id: "u7",
      silver: "given",
      silverUntil: null,
    });
    expect(after("insert", memberSubscription, "values")).toMatchObject({
      userId: "u7",
      plan: "silver",
      currentPeriodEnd: FOUNDER_SILVER_UNTIL,
      grantedBy: "u1",
    });
    expect(after("insert", moderationLog, "values")).toEqual({
      actorId: "u1",
      action: "give-silver",
      subjectUserId: "u7",
      detail: "@ladyjane",
    });
    expect(left()).toBe(0);
  });

  it("takes it back and logs that", async () => {
    const { service, after } = make([
      [adminRow],
      [{ end: FOUNDER_SILVER_UNTIL, grantedBy: "u1", paidUntil: null }],
      undefined,
      undefined,
      [{ ...teammate, since }],
    ]);
    await expect(service.setAdminSilver("u2", "u7", false)).resolves.toMatchObject({
      silver: null,
    });
    expect(after("insert", moderationLog, "values")).toMatchObject({
      actorId: "u2",
      action: "remove-silver",
    });
  });

  it("logs nothing when nothing changes", async () => {
    const { service, indexOf } = make([
      [adminRow],
      [{ end: FOUNDER_SILVER_UNTIL, grantedBy: "u2" }],
      [{ ...teammate, since, silverEnd: FOUNDER_SILVER_UNTIL, silverGivenBy: "u2" }],
    ]);
    await service.setAdminSilver("u1", "u7", true);
    expect(indexOf("insert", memberSubscription)).toBe(-1);
    expect(indexOf("insert", moderationLog)).toBe(-1);
  });

  it("only gives Silver to admins", async () => {
    const { service, indexOf } = make([[{ ...adminRow, admin: null }]]);
    await expect(service.setAdminSilver("u1", "u7", true)).rejects.toThrow(
      new ConflictException("Only admins can be given Silver."),
    );
    expect(indexOf("insert", memberSubscription)).toBe(-1);
  });

  it("leaves a founder's Silver alone, either way", async () => {
    for (const enabled of [true, false]) {
      const founder = { ...adminRow, email: "nnabuekassidy@gmail.com" };
      const { service, indexOf } = make([[founder]]);
      await expect(service.setAdminSilver("u1", "u3", enabled)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(indexOf("update", memberSubscription)).toBe(-1);
    }
  });

  it("is a 404 for a member who doesn't exist", async () => {
    const { service } = make([[]]);
    await expect(service.setAdminSilver("u1", "nobody", true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("ModerationService.setOrganization", () => {
  it("makes the account an organization's, tied to its country, and logs it", async () => {
    const { service, after } = make([[{ accountType: "organization", country: "KE" }], undefined]);
    await expect(service.setOrganization("f1", "u7", true, "KE")).resolves.toEqual({
      organization: true,
      country: "KE",
    });
    expect(after("update", profile, "set")).toEqual({ accountType: "organization", country: "KE" });
    expect(after("insert", moderationLog, "values")).toEqual({
      actorId: "f1",
      subjectUserId: "u7",
      action: "make-organization",
      detail: "KE",
    });
  });

  it("makes one that speaks to every country, stored with no country", async () => {
    const { service, after } = make([[{ accountType: "organization", country: null }], undefined]);
    await expect(service.setOrganization("f1", "u1", true, "ALL")).resolves.toEqual({
      organization: true,
      country: null,
    });
    expect(after("update", profile, "set")).toEqual({ accountType: "organization", country: null });
    expect(after("insert", moderationLog, "values")).toMatchObject({
      action: "make-organization",
      detail: "ALL",
    });
  });

  it("needs one of the countries Kinkord serves", async () => {
    for (const country of [null, "GB"]) {
      const { service, indexOf } = make([]);
      await expect(service.setOrganization("f1", "u7", true, country)).rejects.toThrow(
        "Choose the organization's country.",
      );
      expect(indexOf("update", profile)).toBe(-1);
    }
  });

  it("makes it a person's again without moving it", async () => {
    const { service, after } = make([[{ accountType: "person", country: "NG" }], undefined]);
    await expect(service.setOrganization("f1", "u7", false, null)).resolves.toEqual({
      organization: false,
      country: "NG",
    });
    expect(after("update", profile, "set")).toEqual({ accountType: "person" });
    expect(after("insert", moderationLog, "values")).toMatchObject({
      action: "remove-organization",
    });
  });

  it("is a 404 for an account with no profile", async () => {
    const { service } = make([[]]);
    await expect(service.setOrganization("f1", "nobody", true, "NG")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
