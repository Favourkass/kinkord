import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Db, DRIZZLE } from "../db/db.module";
import { profile } from "../db/schema";
import {
  IMAGE_VARIANTS,
  StorageService,
  variantKey,
  type ImageVariant,
} from "../storage/storage.service";

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
  relationshipStatus: z.string().trim().min(1).max(60).nullable().optional(),
  lookingFor: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  orientation: z.string().trim().min(1).max(40).nullable().optional(),
  bodyType: z.string().trim().min(1).max(40).nullable().optional(),
  languages: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  location: z.string().trim().min(1).max(120).nullable().optional(),
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

const maxBytes = (spec: { maxMb: number }) => spec.maxMb * 1024 * 1024;
const tooLarge = (spec: { maxMb: number }) => `Image is too large — max ${spec.maxMb}MB.`;

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
    await this.verifyUploads(input);
    const [row] = await this.db
      .update(profile)
      .set(input)
      .where(eq(profile.userId, userId))
      .returning();
    return this.toVM(row);
  }

  /**
   * Presigned upload slot. A declared `contentLength` is checked against the cap
   * and signed into the URL, so S3 itself rejects a larger body.
   */
  async presignImageUpload(
    userId: string,
    kind: UploadKind,
    contentType: string,
    contentLength?: number,
  ) {
    const spec = UPLOAD_KINDS[kind];
    if (!spec) throw new BadRequestException("kind must be avatar or cover");
    const ext = IMAGE_TYPES[contentType];
    if (!ext) {
      throw new BadRequestException(
        `contentType must be one of: ${Object.keys(IMAGE_TYPES).join(", ")}`,
      );
    }
    if (contentLength !== undefined && (contentLength <= 0 || contentLength > maxBytes(spec))) {
      throw new BadRequestException(tooLarge(spec));
    }
    const key = `${spec.prefix}/${userId}/${randomUUID()}.${ext}`;
    // One slot per stored size. The browser downsizes and uploads all of them;
    // the profile only points at `key` once every one has landed.
    const [uploadUrl, ...variantUrls] = await Promise.all([
      this.storage.presignUpload(key, contentType, contentLength),
      ...IMAGE_VARIANTS.map((v) => this.storage.presignUpload(variantKey(key, v), contentType)),
    ]);
    const variantUploadUrls = Object.fromEntries(
      IMAGE_VARIANTS.map((v, i) => [v, variantUrls[i]]),
    ) as Record<ImageVariant, string>;
    return { key, uploadUrl, variantUploadUrls, expiresInSeconds: 600, maxSizeMb: spec.maxMb };
  }

  /**
   * Server-side half of the upload limits: a key only becomes the avatar/cover
   * once S3 confirms the object exists, is an allowed image type and is within
   * the size cap. Anything else is deleted and the update rejected.
   */
  private async verifyUploads(input: UpdateProfileInput) {
    for (const [field, kind] of [
      ["avatarKey", "avatar"],
      ["coverKey", "cover"],
    ] as const) {
      const key = input[field];
      if (!key) continue;
      const spec = UPLOAD_KINDS[kind];
      const info = await this.storage.describe(key);
      if (!info) throw new BadRequestException(`${field}: upload not found`);
      // Every size must exist, or small surfaces would request a missing object.
      // A client still running the previous app version uploads only the
      // original; rather than reject it, fill each missing size with a copy of
      // the original. Those surfaces then show a full-size image (today's
      // behaviour) instead of a broken one, and nobody is stuck until their app
      // updates. New clients upload real thumbnails and never hit this path.
      await Promise.all(
        IMAGE_VARIANTS.map(async (v) => {
          const target = variantKey(key, v);
          if (!(await this.storage.describe(target))) await this.storage.copy(key, target);
        }),
      );
      if (info.size > maxBytes(spec)) {
        await this.storage.remove(key);
        throw new BadRequestException(tooLarge(spec));
      }
      if (!info.contentType || !IMAGE_TYPES[info.contentType]) {
        await this.storage.remove(key);
        throw new BadRequestException(
          `contentType must be one of: ${Object.keys(IMAGE_TYPES).join(", ")}`,
        );
      }
    }
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
      relationshipStatus: row.relationshipStatus,
      lookingFor: row.lookingFor ?? [],
      interests: row.interests ?? [],
      orientation: row.orientation,
      bodyType: row.bodyType,
      languages: row.languages ?? [],
      location: row.location,
      phone: row.phone,
      phoneVerified: row.phoneVerified,
      avatarUrl: row.avatarKey ? await this.storage.presignDownload(row.avatarKey) : null,
      coverUrl: row.coverKey ? await this.storage.presignDownload(row.coverKey) : null,
      updatedAt: row.updatedAt,
    };
  }
}
