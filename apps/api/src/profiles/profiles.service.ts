import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Db, DRIZZLE } from "../db/db.module";
import { profile } from "../db/schema";
import { StorageService } from "../storage/storage.service";

const eighteenYearsAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
};

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
  state: z.string().trim().min(1).max(80).nullable().optional(),
  city: z.string().trim().min(1).max(80).nullable().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
    .refine((s) => !Number.isNaN(new Date(s).getTime()), "dateOfBirth must be a real date")
    .refine((s) => new Date(s) <= eighteenYearsAgo(), "You must be 18 or older to join")
    .optional(),
  gender: z.string().trim().min(1).max(20).nullable().optional(),
  roles: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, "phone must be E.164, e.g. +2348012345678")
    .nullable()
    .optional(),
  avatarKey: z.string().trim().max(256).nullable().optional(),
  coverKey: z.string().trim().max(256).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

const UPLOAD_KINDS = {
  avatar: { prefix: "avatars", maxMb: 5 },
  cover: { prefix: "covers", maxMb: 10 },
} as const;
export type UploadKind = keyof typeof UPLOAD_KINDS;

const IMAGE_TYPES: Record<string, string> = {
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
    for (const [field, prefix] of [
      ["avatarKey", "avatars"],
      ["coverKey", "covers"],
    ] as const) {
      const key = input[field];
      if (key && !key.startsWith(`${prefix}/${userId}/`)) {
        throw new BadRequestException(`${field} does not belong to this user`);
      }
    }
    const [row] = await this.db
      .update(profile)
      .set(input)
      .where(eq(profile.userId, userId))
      .returning();
    return this.toVM(row);
  }

  async presignImageUpload(userId: string, kind: UploadKind, contentType: string) {
    const spec = UPLOAD_KINDS[kind];
    if (!spec) throw new BadRequestException("kind must be avatar or cover");
    const ext = IMAGE_TYPES[contentType];
    if (!ext) {
      throw new BadRequestException(
        `contentType must be one of: ${Object.keys(IMAGE_TYPES).join(", ")}`,
      );
    }
    const key = `${spec.prefix}/${userId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.storage.presignUpload(key, contentType);
    return { key, uploadUrl, expiresInSeconds: 600, maxSizeMb: spec.maxMb };
  }

  private async toVM(row: typeof profile.$inferSelect) {
    return {
      displayName: row.displayName,
      bio: row.bio,
      pronouns: row.pronouns,
      country: row.country,
      state: row.state,
      city: row.city,
      dateOfBirth: row.dateOfBirth,
      gender: row.gender,
      roles: row.roles ?? [],
      phone: row.phone,
      phoneVerified: row.phoneVerified,
      avatarUrl: row.avatarKey ? await this.storage.presignDownload(row.avatarKey) : null,
      coverUrl: row.coverKey ? await this.storage.presignDownload(row.coverKey) : null,
      updatedAt: row.updatedAt,
    };
  }
}
