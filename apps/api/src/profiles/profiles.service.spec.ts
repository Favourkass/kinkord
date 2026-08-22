import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { type StorageService } from "../storage/storage.service";
import { ProfilesService, updateProfileSchema } from "./profiles.service";

describe("updateProfileSchema", () => {
  it("normalizes country to uppercase ISO alpha-2", () => {
    const parsed = updateProfileSchema.parse({ country: "ng" });
    expect(parsed.country).toBe("NG");
  });

  it("rejects non-ISO country values", () => {
    expect(updateProfileSchema.safeParse({ country: "Nigeria" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ country: "N" }).success).toBe(false);
  });

  it("enforces displayName length bounds", () => {
    expect(updateProfileSchema.safeParse({ displayName: "ab" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ displayName: "a".repeat(31) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ displayName: "FavourK" }).success).toBe(true);
  });

  it("caps bio at 500 characters", () => {
    expect(updateProfileSchema.safeParse({ bio: "a".repeat(501) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ bio: "a".repeat(500) }).success).toBe(true);
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
      avatarKey: null,
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

  it("rejects avatar keys that belong to another user", async () => {
    const service = makeService();
    await expect(
      service.updateOwn("u1", { avatarKey: "avatars/other-user/pic.png" }, "Favour"),
    ).rejects.toThrow(/does not belong/);
  });

  it("rejects unsupported avatar content types and accepts allowed ones", async () => {
    const service = makeService();
    await expect(service.presignAvatarUpload("u1", "image/gif")).rejects.toThrow(/contentType/);
    const ok = await service.presignAvatarUpload("u1", "image/png");
    expect(ok.key).toMatch(/^avatars\/u1\/[0-9a-f-]+\.png$/);
    expect(ok.uploadUrl).toBe("https://s3/upload");
  });
});
