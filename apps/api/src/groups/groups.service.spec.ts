import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import type { Db } from "../db/db.module";
import type { PostsService } from "../posts/posts.service";
import type { PushService } from "../push/push.service";
import type { StorageService } from "../storage/storage.service";
import { groupLog, groupMember } from "../db/schema";
import { membershipOf } from "./group-policy";
import { hasSilver } from "../subscriptions/plans";
import { isAdmin } from "../moderation/admins";
import { GroupsService } from "./groups.service";

vi.mock("./group-policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./group-policy")>()),
  membershipOf: vi.fn(),
}));
vi.mock("../subscriptions/plans", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../subscriptions/plans")>()),
  hasSilver: vi.fn(),
}));
vi.mock("../moderation/admins", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../moderation/admins")>()),
  isAdmin: vi.fn(),
}));

/** A query that resolves to `value` however it's chained. */
const chain = (value: unknown): unknown =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return Promise.resolve(value).then.bind(Promise.resolve(value));
        return () => chain(value);
      },
    },
  );

const OLD_ACCOUNT = new Date("2026-01-01T00:00:00Z");
const openGroup = { id: "g1", slug: "lagos-munch", privacy: "open" as const, name: "Lagos Munch" };
const closedGroup = { ...openGroup, privacy: "closed" as const };
const me = { id: "me", email: "me@example.test", emailVerified: true };

function setup() {
  const select = vi.fn().mockImplementation(() => chain([]));
  const insert = vi.fn().mockImplementation(() => chain([]));
  const update = vi.fn().mockImplementation(() => chain([]));
  const del = vi.fn().mockImplementation(() => chain([]));
  const db = { select, insert, update, delete: del, transaction: vi.fn() } as unknown as Db;
  const posts = {
    groupThreads: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    create: vi.fn().mockResolvedValue({ id: "p1" }),
    byId: vi.fn(),
    remove: vi.fn().mockResolvedValue({ deleted: "p1" }),
    removeAsModerator: vi.fn().mockResolvedValue({ deleted: "p1", authorId: "them" }),
  };
  const push = { groupRequest: vi.fn(), groupApproved: vi.fn() };
  const storage = { presignDownload: vi.fn().mockResolvedValue("signed") };
  const service = new GroupsService(
    db,
    posts as unknown as PostsService,
    push as unknown as PushService,
    storage as unknown as StorageService,
  );
  /** The group the next `live()` lookup finds. */
  const finds = (group: unknown) => select.mockReturnValueOnce(chain([group]));
  return { service, select, insert, update, del, posts, push, finds };
}

const member = (
  role: "owner" | "moderator" | "member",
  status: "active" | "pending" = "active",
) => ({
  role,
  status,
});

beforeEach(() => {
  vi.mocked(membershipOf).mockReset().mockResolvedValue(null);
  vi.mocked(hasSilver).mockReset().mockResolvedValue(false);
  vi.mocked(isAdmin).mockReset().mockResolvedValue(false);
});

describe("GroupsService.create", () => {
  const input = {
    name: "Lagos Munch",
    description: "A monthly munch in Lagos.",
    rules: null,
    category: "local" as const,
    privacy: "open" as const,
    country: "NG",
    state: "Lagos",
  };

  it("keeps creating a group to Silver members, with a code the app can upsell on", async () => {
    const s = setup();
    s.select
      .mockReturnValueOnce(chain([{ createdAt: OLD_ACCOUNT }]))
      .mockReturnValueOnce(chain([{ owned: 0 }]));
    const err = await s.service.create(me, input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: "GROUP_CREATE_SILVER",
    });
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("files a group as official only for Kinkord", async () => {
    const s = setup();
    vi.mocked(hasSilver).mockResolvedValue(true);
    s.select
      .mockReturnValueOnce(chain([{ createdAt: OLD_ACCOUNT }]))
      .mockReturnValueOnce(chain([{ owned: 0 }]));
    await expect(s.service.create(me, { ...input, category: "official" })).rejects.toThrow(
      "Only Kinkord files a group as official.",
    );
    expect(s.insert).not.toHaveBeenCalled();
  });
});

describe("GroupsService.join and leave", () => {
  it("lets anyone straight into an open group, without bothering the moderators", async () => {
    const s = setup();
    s.finds(openGroup);
    s.insert.mockReturnValueOnce(chain([{ userId: "me" }]));
    await expect(s.service.join("me", "lagos-munch")).resolves.toEqual({
      status: "active",
      role: "member",
    });
    expect(s.insert).toHaveBeenCalledWith(groupMember);
    expect(s.push.groupRequest).not.toHaveBeenCalled();
  });

  it("turns joining a closed group into a request each moderator hears about", async () => {
    const s = setup();
    s.finds(closedGroup);
    s.insert.mockReturnValueOnce(chain([{ userId: "me" }]));
    s.select.mockReturnValueOnce(chain([{ userId: "owner" }, { userId: "mod" }]));
    await expect(s.service.join("me", "lagos-munch")).resolves.toEqual({
      status: "pending",
      role: "member",
    });
    expect(s.push.groupRequest).toHaveBeenCalledWith("me", "owner", "lagos-munch");
    expect(s.push.groupRequest).toHaveBeenCalledWith("me", "mod", "lagos-munch");
  });

  it("changes nothing when they're already in or waiting", async () => {
    const s = setup();
    s.finds(closedGroup);
    vi.mocked(membershipOf).mockResolvedValueOnce(member("member", "pending"));
    await expect(s.service.join("me", "lagos-munch")).resolves.toEqual({
      status: "pending",
      role: "member",
    });
    expect(s.insert).not.toHaveBeenCalled();
    expect(s.push.groupRequest).not.toHaveBeenCalled();
  });

  it("doesn't let the owner walk away from their group", async () => {
    const s = setup();
    s.finds(openGroup);
    vi.mocked(membershipOf).mockResolvedValueOnce(member("owner"));
    await expect(s.service.leave("me", "lagos-munch")).rejects.toBeInstanceOf(BadRequestException);
    expect(s.del).not.toHaveBeenCalled();
  });

  it("reads a closed-down or unknown group as gone", async () => {
    const s = setup();
    s.select.mockReturnValueOnce(chain([]));
    await expect(s.service.join("me", "nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("GroupsService moderation", () => {
  it("never removes the owner, and only the owner removes a moderator", async () => {
    const s = setup();
    s.finds(openGroup);
    vi.mocked(membershipOf)
      .mockResolvedValueOnce(member("moderator"))
      .mockResolvedValueOnce(member("owner"));
    await expect(s.service.removeMember("me", "lagos-munch", "boss")).rejects.toThrow(
      "The owner can't be removed.",
    );
    s.finds(openGroup);
    vi.mocked(membershipOf)
      .mockResolvedValueOnce(member("moderator"))
      .mockResolvedValueOnce(member("moderator"));
    await expect(s.service.removeMember("me", "lagos-munch", "other-mod")).rejects.toThrow(
      "Only the owner can remove a moderator.",
    );
    expect(s.del).not.toHaveBeenCalled();
  });

  it("logs the owner removing a moderator, and a declined request as a decline", async () => {
    const s = setup();
    s.finds(openGroup);
    vi.mocked(membershipOf)
      .mockResolvedValueOnce(member("owner"))
      .mockResolvedValueOnce(member("moderator"));
    await s.service.removeMember("me", "lagos-munch", "mod");
    expect(s.del).toHaveBeenCalledWith(groupMember);
    expect(s.insert).toHaveBeenCalledWith(groupLog);
  });

  it("keeps choosing moderators to the owner", async () => {
    const s = setup();
    s.finds(openGroup);
    vi.mocked(membershipOf).mockResolvedValueOnce(member("moderator"));
    await expect(
      s.service.setRole("me", "lagos-munch", "them", "moderator"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.update).not.toHaveBeenCalled();
  });

  it("approves a request only for a moderator, and tells the member", async () => {
    const s = setup();
    s.finds(closedGroup);
    await expect(s.service.approve("me", "lagos-munch", "them")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    s.finds(closedGroup);
    vi.mocked(membershipOf).mockResolvedValueOnce(member("moderator"));
    s.update.mockReturnValueOnce(chain([{ userId: "them" }]));
    await expect(s.service.approve("me", "lagos-munch", "them")).resolves.toEqual({
      status: "active",
    });
    expect(s.push.groupApproved).toHaveBeenCalledWith("me", "them", "lagos-munch");
  });
});

describe("GroupsService discussions", () => {
  it("keeps a closed group's discussions from non-members", async () => {
    const s = setup();
    s.finds(closedGroup);
    await expect(s.service.threads("me", "lagos-munch")).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.posts.groupThreads).not.toHaveBeenCalled();
  });

  it("reads an open group's discussions to anyone, everything to moderators", async () => {
    const s = setup();
    s.finds(openGroup);
    await s.service.threads("me", "lagos-munch");
    expect(s.posts.groupThreads).toHaveBeenLastCalledWith("me", "g1", {
      cursor: undefined,
      moderator: false,
    });
    s.finds(openGroup);
    vi.mocked(membershipOf).mockResolvedValueOnce(member("moderator"));
    await s.service.threads("me", "lagos-munch", "2026-10-20T00:00:00.000Z");
    expect(s.posts.groupThreads).toHaveBeenLastCalledWith("me", "g1", {
      cursor: "2026-10-20T00:00:00.000Z",
      moderator: true,
    });
  });

  it("starts discussions for members only, within the daily cap", async () => {
    const s = setup();
    const input = { title: "First munch", body: "Who's coming?", media: [] };
    s.finds(openGroup);
    await expect(s.service.createThread("me", "lagos-munch", input)).rejects.toThrow(
      "Join the group to start a discussion.",
    );
    s.finds(openGroup);
    vi.mocked(membershipOf).mockResolvedValueOnce(member("member"));
    s.select.mockReturnValueOnce(chain([{ n: 10 }]));
    const err = await s.service.createThread("me", "lagos-munch", input).catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(s.posts.create).not.toHaveBeenCalled();

    s.finds(openGroup);
    vi.mocked(membershipOf).mockResolvedValueOnce(member("member"));
    s.select.mockReturnValueOnce(chain([{ n: 2 }]));
    await s.service.createThread("me", "lagos-munch", input);
    expect(s.posts.create).toHaveBeenCalledWith(
      "me",
      { body: "Who's coming?", media: [], visibility: "public" },
      { groupId: "g1", title: "First munch" },
    );
  });

  it("finds a discussion only in its own group", async () => {
    const s = setup();
    s.finds(openGroup);
    s.posts.byId.mockResolvedValueOnce({ id: "p1", group: { id: "other-group" } });
    await expect(s.service.thread("me", "lagos-munch", "p1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(s.posts.byId).toHaveBeenCalledWith("p1", "me", { groups: true });
  });

  it("lets the author take a discussion down, and logs a moderator removing it", async () => {
    const s = setup();
    s.finds(openGroup);
    s.select.mockReturnValueOnce(chain([{ authorId: "me" }]));
    await s.service.removeThread("me", "lagos-munch", "p1");
    expect(s.posts.remove).toHaveBeenCalledWith("p1", "me");

    s.finds(openGroup);
    s.select.mockReturnValueOnce(chain([{ authorId: "them" }]));
    await expect(s.service.removeThread("me", "lagos-munch", "p1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    s.finds(openGroup);
    s.select.mockReturnValueOnce(chain([{ authorId: "them" }]));
    vi.mocked(membershipOf).mockResolvedValueOnce(member("moderator"));
    await s.service.removeThread("me", "lagos-munch", "p1");
    expect(s.posts.removeAsModerator).toHaveBeenCalledWith("p1");
    expect(s.insert).toHaveBeenCalledWith(groupLog);
  });
});
