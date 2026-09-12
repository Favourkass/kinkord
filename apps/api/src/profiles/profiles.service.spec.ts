import { describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ConflictException,
  type HttpException,
  NotFoundException,
} from "@nestjs/common";
import { type Db } from "../db/db.module";
import { type StorageService } from "../storage/storage.service";
import {
  ProfilesService,
  lockMessage,
  nextAllowedChange,
  updateProfileSchema,
} from "./profiles.service";

/** The field-error body of a rejected call (Nest keeps it in `getResponse()`). */
const responseOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as HttpException).getResponse();
  }
  throw new Error("expected the call to reject");
};

describe("updateProfileSchema", () => {
  it("normalizes country to uppercase ISO alpha-2", () => {
    expect(updateProfileSchema.parse({ country: "ng" }).country).toBe("NG");
  });

  it("rejects non-ISO country values", () => {
    expect(updateProfileSchema.safeParse({ country: "Nigeria" }).success).toBe(false);
  });

  it("enforces displayName length bounds", () => {
    expect(updateProfileSchema.safeParse({ displayName: "ab" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ displayName: "FavourK" }).success).toBe(true);
  });

  it("accepts an adult date of birth and rejects minors", () => {
    expect(updateProfileSchema.safeParse({ dateOfBirth: "2000-01-15" }).success).toBe(true);
    const seventeenYearsAgo = new Date();
    seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
    const minorDob = seventeenYearsAgo.toISOString().slice(0, 10);
    const result = updateProfileSchema.safeParse({ dateOfBirth: minorDob });
    expect(result.success).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(updateProfileSchema.safeParse({ dateOfBirth: "15/01/2000" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ dateOfBirth: "2000-13-45" }).success).toBe(false);
  });

  it("validates roles list and phone format", () => {
    expect(updateProfileSchema.safeParse({ roles: ["Dominant", "Top"] }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ roles: Array(11).fill("x") }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ phone: "+2348012345678" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ phone: "0801 234 5678" }).success).toBe(false);
  });

  it("validates the edit-profile persona fields", () => {
    const ok = updateProfileSchema.parse({
      relationshipStatus: "Head of Household (HoH)",
      lookingFor: ["Events", "Friendship"],
      interests: ["Bondage", "Latex", "Leather"],
      location: "Sapele, Delta State, Nigeria",
    });
    expect(ok.relationshipStatus).toBe("Head of Household (HoH)");
    expect(ok.lookingFor).toEqual(["Events", "Friendship"]);
    expect(ok.interests).toHaveLength(3);
    expect(updateProfileSchema.safeParse({ lookingFor: Array(11).fill("Events") }).success).toBe(
      false,
    );
    expect(updateProfileSchema.safeParse({ interests: Array(21).fill("Bondage") }).success).toBe(
      false,
    );
    expect(updateProfileSchema.safeParse({ location: "" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ relationshipStatus: null }).success).toBe(true);
  });

  it("canonicalises gender and only accepts Male/Female (CEO brief)", () => {
    expect(updateProfileSchema.parse({ gender: "female" }).gender).toBe("Female");
    expect(updateProfileSchema.parse({ gender: " MALE " }).gender).toBe("Male");
    expect(updateProfileSchema.parse({ gender: null }).gender).toBeNull();
    expect(updateProfileSchema.safeParse({ gender: "Non-binary" }).success).toBe(false);
  });

  it("only accepts listed statuses, kinks, roles (plus legacy roles), looking-for and languages", () => {
    const ok = (body: unknown) => updateProfileSchema.safeParse(body).success;
    expect(ok({ relationshipStatus: "Head of House" })).toBe(false);
    expect(ok({ interests: ["Rope bondage", "Wax play"] })).toBe(true);
    expect(ok({ interests: ["Shibari"] })).toBe(false);
    // "Rigger" was offered by the old signup wizard; still accepted, no longer offered.
    expect(ok({ roles: ["Domme", "Rigger"] })).toBe(true);
    expect(ok({ roles: ["Overlord"] })).toBe(false);
    expect(ok({ lookingFor: ["Events", "Mentorship / Guidance"] })).toBe(true);
    expect(ok({ lookingFor: ["Relationships"] })).toBe(false);
    expect(ok({ languages: ["English", "Pidgin"] })).toBe(true);
    expect(ok({ languages: ["Klingon"] })).toBe(false);
  });

  it("validates the new About fields: nationality, occupation, limits, links, visibility", () => {
    const ok = updateProfileSchema.parse({
      nationality: "ng",
      occupation: " Entrepreneur ",
      limits: "No blood.",
      socialLinks: { facebook: "https://facebook.com/nene", x: null },
      profileVisibility: "friends",
    });
    expect(ok.nationality).toBe("NG");
    expect(ok.occupation).toBe("Entrepreneur");
    expect(ok.limits).toBe("No blood.");
    expect(ok.socialLinks).toEqual({ facebook: "https://facebook.com/nene", x: null });
    expect(ok.profileVisibility).toBe("friends");
    const bad = (body: unknown) => updateProfileSchema.safeParse(body).success;
    expect(bad({ socialLinks: { facebook: "http://facebook.com/nene" } })).toBe(false);
    expect(bad({ socialLinks: { instagram: "https://instagram.com/x" } })).toBe(false);
    expect(bad({ profileVisibility: "secret" })).toBe(false);
    expect(bad({ nationality: "Nigerian" })).toBe(false);
    expect(bad({ occupation: "" })).toBe(false);
  });
});

describe("name change locks (once every 30 days)", () => {
  const now = new Date("2026-09-12T10:00:00Z");

  it("nextAllowedChange: free when never changed or after 30 days, locked inside the window", () => {
    expect(nextAllowedChange(null, now)).toBeNull();
    expect(nextAllowedChange(new Date("2026-08-01T00:00:00Z"), now)).toBeNull();
    expect(nextAllowedChange(new Date("2026-09-01T00:00:00Z"), now)?.toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
    expect(lockMessage("username", new Date("2026-10-01T00:00:00Z"))).toBe(
      "You can change your username again on 1 Oct 2026.",
    );
  });
});

describe("ProfilesService", () => {
  /** `selects` are returned by successive select() calls before falling back to the profile row. */
  const makeService = ({ selects = [] as unknown[][] } = {}) => {
    const row = {
      userId: "u1",
      displayName: "Favour",
      bio: null,
      pronouns: null,
      country: null,
      state: null,
      city: null,
      dateOfBirth: null as string | null,
      gender: null,
      roles: [] as string[],
      relationshipStatus: null,
      lookingFor: [] as string[],
      interests: [] as string[],
      orientation: null,
      bodyType: null,
      languages: [] as string[],
      lastSeenAt: null,
      location: null,
      phone: null,
      phoneVerified: false,
      avatarKey: null,
      coverKey: null,
      nationality: null,
      occupation: null,
      limits: null,
      socialLinks: {},
      profileVisibility: "public",
      displayNameChangedAt: null as Date | null,
      usernameChangedAt: null as Date | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const queue = [...selects];
    const setCalls: unknown[] = [];
    const update = vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        setCalls.push(values);
        return { where: vi.fn(() => ({ returning: vi.fn(async () => [row]) })) };
      }),
    }));
    const transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn({ update }));
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => (queue.length ? queue.shift() : [row])),
        })),
      })),
      update,
      insert: vi.fn(),
      transaction,
    } as unknown as Db;
    const storage = {
      presignUpload: vi.fn(async () => "https://s3/upload"),
      presignDownload: vi.fn(async () => "https://s3/download"),
      describe: vi.fn(async () => ({ size: 120_000, contentType: "image/jpeg" })),
      remove: vi.fn(async () => undefined),
      copy: vi.fn(async () => undefined),
    };
    return {
      service: new ProfilesService(db, storage as unknown as StorageService),
      storage,
      db,
      row,
      setCalls,
      transaction,
    };
  };
  const now = new Date("2026-09-12T10:00:00Z");
  const account = { username: "tega", displayUsername: "Tega", name: "Tega" };

  it("stamps the first display-name change and refuses another inside 30 days", async () => {
    const { service, setCalls, row } = makeService();
    await service.updateOwn("u1", { displayName: "Favour K" }, "Favour", now);
    expect(setCalls[0]).toMatchObject({ displayName: "Favour K", displayNameChangedAt: now });

    row.displayNameChangedAt = now;
    row.displayName = "Favour K";
    const later = new Date("2026-09-20T00:00:00Z");
    await expect(
      responseOf(service.updateOwn("u1", { displayName: "Someone Else" }, "Favour", later)),
    ).resolves.toEqual({
      displayName: ["You can change your display name again on 12 Oct 2026."],
    });
    // Re-sending the current name alongside other edits is not a change.
    setCalls.length = 0;
    await service.updateOwn("u1", { displayName: "Favour K", bio: "hi" }, "Favour", later);
    expect(setCalls[0]).not.toHaveProperty("displayNameChangedAt");
    expect(setCalls[0]).toMatchObject({ bio: "hi" });
  });

  it("exposes the new fields and lock dates in the own-profile VM", async () => {
    const { service, row } = makeService();
    row.usernameChangedAt = new Date("2026-09-01T00:00:00Z");
    const vm = await service.getOwn("u1", "Favour");
    expect(vm.socialLinks).toEqual({});
    expect(vm.profileVisibility).toBe("public");
    expect(vm.nationality).toBeNull();
    expect(vm.canChangeDisplayNameAt).toBeNull();
    expect(vm.usernameChangedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(typeof vm.canChangeUsernameAt).toBe("string");
  });

  describe("changeUsername", () => {
    it("rejects malformed handles before touching the database", async () => {
      const { service, db } = makeService();
      for (const bad of ["no spaces", "ab", "way-too-long-because-hyphens-are-not-allowed-x"]) {
        await expect(service.changeUsername("u1", bad, now)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
      expect(db.select).not.toHaveBeenCalled();
    });

    it("updates user + profile in one transaction and returns the next allowed date", async () => {
      const { service, setCalls, transaction } = makeService({ selects: [[account]] });
      const vm = await service.changeUsername("u1", "@Sir.Tega", now);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(setCalls).toEqual([
        { username: "sir.tega", displayUsername: "Sir.Tega" },
        { usernameChangedAt: now },
      ]);
      expect(vm).toEqual({
        username: "sir.tega",
        displayUsername: "Sir.Tega",
        usernameChangedAt: now.toISOString(),
        canChangeUsernameAt: "2026-10-12T10:00:00.000Z",
      });
    });

    it("is a no-op when the handle is unchanged", async () => {
      const { service, transaction } = makeService({ selects: [[account]] });
      const vm = await service.changeUsername("u1", "Tega", now);
      expect(transaction).not.toHaveBeenCalled();
      expect(vm.canChangeUsernameAt).toBeNull();
    });

    it("refuses a second change inside 30 days", async () => {
      const { service, row, transaction } = makeService({ selects: [[account]] });
      row.usernameChangedAt = new Date("2026-09-01T00:00:00Z");
      await expect(responseOf(service.changeUsername("u1", "newname", now))).resolves.toEqual({
        username: ["You can change your username again on 1 Oct 2026."],
      });
      expect(transaction).not.toHaveBeenCalled();
    });

    it("turns a unique violation into a 409, wrapped or not", async () => {
      for (const failure of [{ code: "23505" }, { cause: { code: "23505" } }]) {
        const { service, transaction } = makeService({ selects: [[account]] });
        transaction.mockRejectedValueOnce(failure);
        await expect(service.changeUsername("u1", "taken", now)).rejects.toBeInstanceOf(
          ConflictException,
        );
      }
    });

    it("404s when the account row is missing", async () => {
      const { service } = makeService({ selects: [[]] });
      await expect(service.changeUsername("u1", "ghost", now)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  it("rejects avatar and cover keys that belong to another user", async () => {
    const { service } = makeService();
    await expect(
      service.updateOwn("u1", { avatarKey: "avatars/other/pic.png" }, "Favour"),
    ).rejects.toThrow(/does not belong/);
    await expect(
      service.updateOwn("u1", { coverKey: "covers/other/pic.png" }, "Favour"),
    ).rejects.toThrow(/does not belong/);
  });

  it("stores an uploaded key only after S3 confirms a valid, in-limit image", async () => {
    const { service, storage, db } = makeService();
    await service.updateOwn("u1", { avatarKey: "avatars/u1/pic.jpg" }, "Favour");
    expect(storage.describe).toHaveBeenCalledWith("avatars/u1/pic.jpg");
    expect(storage.remove).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it("fills a missing size with a copy of the original instead of rejecting (old clients)", async () => {
    const { service, storage, db } = makeService();
    // Original present, the "sm" variant missing, "md" present.
    storage.describe
      .mockResolvedValueOnce({ size: 120_000, contentType: "image/jpeg" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ size: 9_000, contentType: "image/jpeg" });
    await service.updateOwn("u1", { avatarKey: "avatars/u1/pic.jpg" }, "Favour");
    expect(storage.copy).toHaveBeenCalledTimes(1);
    expect(storage.copy).toHaveBeenCalledWith("avatars/u1/pic.jpg", "avatars/u1/pic_sm.jpg");
    expect(storage.remove).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it("copies nothing when every size already exists (new clients)", async () => {
    const { service, storage } = makeService();
    await service.updateOwn("u1", { avatarKey: "avatars/u1/pic.jpg" }, "Favour");
    expect(storage.copy).not.toHaveBeenCalled();
  });

  it("checks the original and every stored size before saving the key", async () => {
    const { service, storage } = makeService();
    await service.updateOwn("u1", { avatarKey: "avatars/u1/pic.jpg" }, "Favour");
    expect(storage.describe.mock.calls.map((c) => c[0])).toEqual([
      "avatars/u1/pic.jpg",
      "avatars/u1/pic_sm.jpg",
      "avatars/u1/pic_md.jpg",
    ]);
  });

  it("hands back a presigned slot for the original and for every variant", async () => {
    const { service } = makeService();
    const slot = await service.presignImageUpload("u1", "avatar", "image/jpeg", 200_000);
    expect(slot.key).toMatch(/^avatars\/u1\/[0-9a-f-]+\.jpg$/);
    expect(Object.keys(slot.variantUploadUrls)).toEqual(["sm", "md"]);
  });

  it("rejects a PATCH whose key was never uploaded", async () => {
    const { service, storage, db } = makeService();
    storage.describe.mockResolvedValueOnce(null);
    await expect(
      service.updateOwn("u1", { coverKey: "covers/u1/missing.jpg" }, "Favour"),
    ).rejects.toThrow(/upload not found/);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("deletes and rejects an oversized upload (server-side size cap)", async () => {
    const { service, storage, db } = makeService();
    storage.describe.mockResolvedValueOnce({ size: 6 * 1024 * 1024, contentType: "image/jpeg" });
    await expect(
      service.updateOwn("u1", { avatarKey: "avatars/u1/huge.jpg" }, "Favour"),
    ).rejects.toThrow(/too large — max 5MB/);
    expect(storage.remove).toHaveBeenCalledWith("avatars/u1/huge.jpg");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("deletes and rejects an upload that is not an allowed image type", async () => {
    const { service, storage } = makeService();
    storage.describe.mockResolvedValueOnce({ size: 1000, contentType: "application/pdf" });
    await expect(
      service.updateOwn("u1", { coverKey: "covers/u1/doc.pdf" }, "Favour"),
    ).rejects.toThrow(/contentType must be one of/);
    expect(storage.remove).toHaveBeenCalledWith("covers/u1/doc.pdf");
  });

  it("skips the S3 check when no image key is being changed", async () => {
    const { service, storage } = makeService();
    await service.updateOwn("u1", { bio: "hi" }, "Favour");
    expect(storage.describe).not.toHaveBeenCalled();
  });

  it("exposes phoneVerified=false in the VM until SMS verification exists", async () => {
    const vm = await makeService().service.getOwn("u1", "Favour");
    expect(vm.phoneVerified).toBe(false);
  });

  it("maps the persona fields into the VM with array defaults", async () => {
    const vm = await makeService().service.getOwn("u1", "Favour");
    expect(vm.relationshipStatus).toBeNull();
    expect(vm.lookingFor).toEqual([]);
    expect(vm.interests).toEqual([]);
    expect(vm.location).toBeNull();
  });

  it("presigns avatar and cover uploads under per-user prefixes", async () => {
    const { service } = makeService();
    const avatar = await service.presignImageUpload("u1", "avatar", "image/png");
    expect(avatar.key).toMatch(/^avatars\/u1\/[0-9a-f-]+\.png$/);
    expect(avatar.maxSizeMb).toBe(5);
    const cover = await service.presignImageUpload("u1", "cover", "image/webp");
    expect(cover.key).toMatch(/^covers\/u1\/[0-9a-f-]+\.webp$/);
    expect(cover.maxSizeMb).toBe(10);
  });

  it("signs a declared byte size into the upload and refuses one over the cap", async () => {
    const { service, storage } = makeService();
    await service.presignImageUpload("u1", "avatar", "image/jpeg", 300_000);
    expect(storage.presignUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^avatars\/u1\//),
      "image/jpeg",
      300_000,
    );
    await expect(
      service.presignImageUpload("u1", "avatar", "image/jpeg", 5 * 1024 * 1024 + 1),
    ).rejects.toThrow(/too large — max 5MB/);
    await expect(
      service.presignImageUpload("u1", "cover", "image/jpeg", 11 * 1024 * 1024),
    ).rejects.toThrow(/too large — max 10MB/);
  });

  it("rejects unsupported content types", async () => {
    await expect(
      makeService().service.presignImageUpload("u1", "avatar", "image/gif"),
    ).rejects.toThrow(/contentType/);
  });
});
