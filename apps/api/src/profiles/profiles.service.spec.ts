import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { type StorageService } from "../storage/storage.service";
import { ProfilesService, updateProfileSchema } from "./profiles.service";

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
    expect(updateProfileSchema.safeParse({ roles: ["Dominant", "Rope top"] }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ roles: Array(11).fill("x") }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ phone: "+2348012345678" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ phone: "0801 234 5678" }).success).toBe(false);
  });
});

describe("ProfilesService", () => {
  const makeService = () => {
    const row = {
      userId: "u1",
      displayName: "Favour",
      bio: null,
      pronouns: null,
      country: null,
      state: null,
      city: null,
      dateOfBirth: null,
      gender: null,
      roles: [],
      phone: null,
      phoneVerified: false,
      avatarKey: null,
      coverKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [row]) })) })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [row]) })) })),
      })),
      insert: vi.fn(),
    } as unknown as Db;
    const storage = {
      presignUpload: vi.fn(async () => "https://s3/upload"),
      presignDownload: vi.fn(async () => "https://s3/download"),
    } as unknown as StorageService;
    return new ProfilesService(db, storage);
  };

  it("rejects avatar and cover keys that belong to another user", async () => {
    const service = makeService();
    await expect(
      service.updateOwn("u1", { avatarKey: "avatars/other/pic.png" }, "Favour"),
    ).rejects.toThrow(/does not belong/);
    await expect(
      service.updateOwn("u1", { coverKey: "covers/other/pic.png" }, "Favour"),
    ).rejects.toThrow(/does not belong/);
  });

  it("exposes phoneVerified=false in the VM until SMS verification exists", async () => {
    const vm = await makeService().getOwn("u1", "Favour");
    expect(vm.phoneVerified).toBe(false);
  });

  it("presigns avatar and cover uploads under per-user prefixes", async () => {
    const service = makeService();
    const avatar = await service.presignImageUpload("u1", "avatar", "image/png");
    expect(avatar.key).toMatch(/^avatars\/u1\/[0-9a-f-]+\.png$/);
    expect(avatar.maxSizeMb).toBe(5);
    const cover = await service.presignImageUpload("u1", "cover", "image/webp");
    expect(cover.key).toMatch(/^covers\/u1\/[0-9a-f-]+\.webp$/);
    expect(cover.maxSizeMb).toBe(10);
  });

  it("rejects unsupported content types", async () => {
    await expect(makeService().presignImageUpload("u1", "avatar", "image/gif")).rejects.toThrow(
      /contentType/,
    );
  });
});
