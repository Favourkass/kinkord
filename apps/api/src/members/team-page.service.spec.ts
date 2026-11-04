import { describe, expect, it, vi } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { type Db } from "../db/db.module";
import { moderationLog, profile } from "../db/schema";
import { FIXED_TEAM_TITLES } from "../moderation/admins";
import { type StorageService } from "../storage/storage.service";
import { TeamPageService } from "./team-page.service";

/** Answers each select in the order it's made; writes go through a transaction. */
function fake(...answers: unknown[][]) {
  const queue = [...answers];
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const step of ["from", "leftJoin", "innerJoin", "where", "orderBy", "limit"]) {
      c[step] = () => c;
    }
    c.then = (ok: (rows: unknown[]) => unknown) => Promise.resolve(queue.shift() ?? []).then(ok);
    return c;
  };
  const set = vi.fn();
  const returning = vi.fn(async () => [] as unknown[]);
  const values = vi.fn(async () => undefined);
  const tx = {
    update: vi.fn(() => {
      const where = () => ({ returning, then: (ok: () => unknown) => Promise.resolve().then(ok) });
      set.mockReturnValue({ where });
      return { set };
    }),
    insert: vi.fn(() => ({ values })),
  };
  const db = {
    select: vi.fn(() => chain()),
    transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as Db;
  const storage = {
    presignDownload: vi.fn(async (key: string, size: string) => `https://cdn.test/${key}?${size}`),
  } as unknown as StorageService;
  return { service: new TeamPageService(db, storage), tx, set, returning, values, storage };
}

const adminRow = {
  id: "u7",
  username: "ada",
  displayName: "Ada",
  avatarKey: "avatars/u7/a.jpg",
  title: "Software Engineer",
  blocked: false,
};

describe("TeamPageService.list", () => {
  it("shows each member's name, handle, photo and role, and nothing else", async () => {
    const { service, storage } = fake([
      {
        username: "ada",
        displayName: "Ada",
        avatarKey: "avatars/u7/a.jpg",
        title: "Software Engineer",
      },
      { username: "kemi", displayName: "Kemi", avatarKey: null, title: "Community Educator" },
    ]);
    await expect(service.list()).resolves.toEqual([
      {
        username: "ada",
        displayName: "Ada",
        avatarUrl: "https://cdn.test/avatars/u7/a.jpg?md",
        title: "Software Engineer",
      },
      { username: "kemi", displayName: "Kemi", avatarUrl: null, title: "Community Educator" },
    ]);
    expect(storage.presignDownload).toHaveBeenCalledExactlyOnceWith("avatars/u7/a.jpg", "md");
  });
});

describe("TeamPageService.forAdmins", () => {
  it("lists the Kinkord Team, with or without a role, and says who is blocked", async () => {
    const { service } = fake([adminRow, { ...adminRow, id: "u8", title: null, blocked: true }]);
    const rows = await service.forAdmins();
    expect(rows[0]).toEqual({
      id: "u7",
      username: "ada",
      displayName: "Ada",
      avatarUrl: "https://cdn.test/avatars/u7/a.jpg?sm",
      title: "Software Engineer",
      blocked: false,
    });
    expect(rows[1]).toMatchObject({ id: "u8", title: null, blocked: true });
  });
});

describe("TeamPageService.setTitle", () => {
  it("puts the member on the page with the badge and their role, and logs it", async () => {
    const { service, tx, set, values } = fake([{ id: "u7", hasProfile: "u7" }], [], [adminRow]);
    await expect(service.setTitle("f1", "@Ada ", "Software Engineer")).resolves.toMatchObject({
      id: "u7",
      title: "Software Engineer",
    });
    expect(tx.update).toHaveBeenCalledExactlyOnceWith(profile);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ teamMember: true, teamTitle: "Software Engineer" }),
    );
    expect(tx.insert).toHaveBeenCalledExactlyOnceWith(moderationLog);
    expect(values).toHaveBeenCalledWith({
      actorId: "f1",
      subjectUserId: "u7",
      action: "set-team-title",
      detail: "Software Engineer",
    });
  });

  it("names the handle it couldn't find", async () => {
    const { service, tx } = fake([]);
    await expect(service.setTitle("f1", "@Nobody", "Engineer")).rejects.toThrow(
      new NotFoundException("No member has the username @nobody."),
    );
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("turns away a blocked member", async () => {
    const { service, tx } = fake([{ id: "u9", hasProfile: "u9" }], [{ userId: "u9" }]);
    await expect(service.setTitle("f1", "troll", "Engineer")).rejects.toThrow(ConflictException);
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe("TeamPageService.remove", () => {
  it("takes the role and the badge away, and logs it", async () => {
    const { service, set, returning, values } = fake();
    returning.mockResolvedValueOnce([{ id: "u7" }]);
    await expect(service.remove("f1", "u7")).resolves.toEqual({ removed: "u7" });
    expect(set).toHaveBeenCalledWith({ teamMember: false, teamTitle: null, teamTitleAt: null });
    expect(values).toHaveBeenCalledWith({
      actorId: "f1",
      subjectUserId: "u7",
      action: "remove-team-member",
    });
  });

  it("says so when they aren't on the team, without logging", async () => {
    const { service, values } = fake();
    await expect(service.remove("f1", "u7")).rejects.toThrow(NotFoundException);
    expect(values).not.toHaveBeenCalled();
  });
});

describe("TeamPageService fixed places", () => {
  const [email] = Object.keys(FIXED_TEAM_TITLES);

  it("gives a fixed account its badge and role, first on the page, at start", async () => {
    const set = vi.fn(() => ({ where: async () => undefined }));
    const pick = {
      from: () => pick,
      where: async () => [{ id: "f1", email: email.toUpperCase() }],
    };
    const db = { select: () => pick, update: vi.fn(() => ({ set })) } as unknown as Db;
    await new TeamPageService(db, {} as StorageService).placeFixedTeam();
    expect(db.update).toHaveBeenCalledWith(profile);
    expect(set).toHaveBeenCalledWith({
      teamMember: true,
      teamTitle: FIXED_TEAM_TITLES[email],
      teamTitleAt: new Date(0),
    });
  });

  it("never stops the API starting", async () => {
    const db = {
      select: () => {
        throw new Error("db down");
      },
    } as unknown as Db;
    await expect(new TeamPageService(db, {} as StorageService).placeFixedTeam()).resolves.toBe(
      undefined,
    );
  });

  it("won't change a fixed account's role", async () => {
    const { service, tx } = fake([{ id: "f1", hasProfile: "f1", email, emailVerified: true }]);
    await expect(service.setTitle("f2", "favour", "Intern")).rejects.toThrow(
      "fixed and can't be changed here",
    );
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("won't take a fixed account off the page", async () => {
    const { service, tx } = fake([{ email, emailVerified: true }]);
    await expect(service.remove("f2", "f1")).rejects.toThrow(ConflictException);
    expect(tx.update).not.toHaveBeenCalled();
  });
});
