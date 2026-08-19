import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Db, DRIZZLE } from "../db/db.module";
import { profile } from "../db/schema";
import { StorageService } from "../storage/storage.service";

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(3).max(30).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  pronouns: z.string().trim().max(30).nullable().optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "country must be ISO 3166-1 alpha-2")
    .nullable()
    .optional(),
  avatarKey: z.string().trim().max(256).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  /** Profile is created at signup; upsert covers accounts predating that hook. */
  async getOwn(userId: string, fallbackName: string) {
    const [row] = await this.db.select().from(profile).where(eq(profile.userId, userId));
    if (row) return this.toVM(row);
    const [created] = await this.db
      .insert(profile)
      .values({ userId, displayName: fallbackName })
      .onConflictDoNothing()
      .returning();
    return this.toVM(created);
  }

  async updateOwn(userId: string, input: UpdateProfileInput, fallbackName: string) {
    await this.getOwn(userId, fallbackName);
    if (input.avatarKey && !input.avatarKey.startsWith(`avatars/${userId}/`)) {
      throw new BadRequestException("avatarKey does not belong to this user");
    }
    const [row] = await this.db
      .update(profile)
      .set(input)
      .where(eq(profile.userId, userId))
      .returning();
    return this.toVM(row);
  }

  async presignAvatarUpload(userId: string, contentType: string) {
    const ext = AVATAR_TYPES[contentType];
    if (!ext) {
      throw new BadRequestException(
        `contentType must be one of: ${Object.keys(AVATAR_TYPES).join(", ")}`,
      );
    }
    const key = `avatars/${userId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.storage.presignUpload(key, contentType);
    return { key, uploadUrl, expiresInSeconds: 600 };
  }

  private async toVM(row: typeof profile.$inferSelect) {
    return {
      displayName: row.displayName,
      bio: row.bio,
      pronouns: row.pronouns,
      country: row.country,
      avatarUrl: row.avatarKey ? await this.storage.presignDownload(row.avatarKey) : null,
      updatedAt: row.updatedAt,
    };
  }
}
