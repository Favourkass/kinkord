import type { BronzeService } from "../verification/bronze.service";
import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { memberBan, moderationLog, session, signupBlock, user } from "../db/schema";
import type { PostsService } from "../posts/posts.service";
import type { StorageService } from "../storage/storage.service";
import { containsPattern, ModerationService, normalizeRuleValue } from "./moderation.service";

/**
 * A stand-in for the Drizzle client. Every builder call returns the chain, and
 * each `await` takes the next queued answer, so a spec lists the database's
 * replies in the order the code asks and then checks what was written.
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
  const indexOf = (op: string, table: unknown) =>
    calls.findIndex((c) => c.op === op && c.args[0] === table);
  /** The argument `op` received next after `anchor` was called on `table`. */
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = indexOf(anchor, table);
    return start < 0 ? undefined : calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: chain() as never, calls, indexOf, after };
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
  phone: "+2349054291043",
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
      [{ phone: "+2349054291043" }, { phone: "08000000000" }], // phones they verified
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
      "phone:+2348000000000:block",
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
    const target = { ...member, email: "x@y.com", emailVerified: false, phone: null };
    const { service, storage, indexOf, after, verification } = make([
      [target],
      [],
      [], // no IPs
      [], // no verified phones
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
    // What Didit holds is erased while the account still exists to find it by.
    expect(verification.forgetMember).toHaveBeenCalledWith("u9");
    // The rules are written while the account still exists to read them from.
    expect(indexOf("insert", signupBlock)).toBeLessThan(indexOf("delete", user));
    expect(after("insert", moderationLog, "values")).toMatchObject({
      action: "delete+block",
      detail: "@downtoearth x@y.com",
    });
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
