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

  it("validates the edit-profile persona fields", () => {
    const ok = updateProfileSchema.parse({
      relationshipStatus: "  Head of House ",
      lookingFor: ["Events", "Relationships"],
      interests: ["DDLG", "Bondage", "Sensual Domination"],
      location: "Sapele, Delta State, Nigeria",
    });
    expect(ok.relationshipStatus).toBe("Head of House");
    expect(ok.lookingFor).toEqual(["Events", "Relationships"]);
    expect(ok.interests).toHaveLength(3);
    expect(updateProfileSchema.safeParse({ lookingFor: Array(11).fill("x") }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ interests: Array(16).fill("x") }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ location: "" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ relationshipStatus: null }).success).toBe(true);
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
      relationshipStatus: null,
      lookingFor: [],
      interests: [],
      location: null,
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
      describe: vi.fn(async () => ({ size: 120_000, contentType: "image/jpeg" })),
      remove: vi.fn(async () => undefined),
      copy: vi.fn(async () => undefined),
    };
    return {
      service: new ProfilesService(db, storage as unknown as StorageService),
      storage,
      db,
    };
  };

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
