import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Db, DRIZZLE } from "../db/db.module";
import { profile, profileMedia, user } from "../db/schema";
import {
  IMAGE_VARIANTS,
  StorageService,
  variantKey,
  type ImageVariant,
} from "../storage/storage.service";
import {
  ACCEPTED_KINK_ROLES,
  GENDERS,
  KINKS,
  LANGUAGES,
  LOOKING_FOR,
  NAME_CHANGE_COOLDOWN_DAYS,
  PROFILE_VISIBILITIES,
  RELATIONSHIP_STATUSES,
} from "./profile-options";

const eighteenYearsAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
};

const isoCountry = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "must be ISO 3166-1 alpha-2");

/** "female" / " FEMALE " -> "Female"; anything else is left for the enum to reject. */
const canonicalGender = (v: string) =>
  GENDERS.find((g) => g.toLowerCase() === v.trim().toLowerCase()) ?? v.trim();

/** Public https link; blank/null clears it. */
const socialUrl = z
  .string()
  .trim()
  .max(200)
  .url()
  .refine((u) => u.startsWith("https://"), "Links must start with https://")
  .nullable();

export const socialLinksSchema = z
  .object({ facebook: socialUrl.optional(), x: socialUrl.optional() })
  .strict();

/**
 * PATCH /profile body. Everything a member picks from a list (CEO brief, 2026-09-12)
 * is validated against `profile-options`; only bio, limits, occupation and the links
 * are free text.
 */
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(3).max(30).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  pronouns: z.string().trim().max(30).nullable().optional(),
  country: isoCountry.nullable().optional(),
  state: z.string().trim().min(1).max(80).nullable().optional(),
  city: z.string().trim().min(1).max(80).nullable().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
    .refine((s) => !Number.isNaN(new Date(s).getTime()), "dateOfBirth must be a real date")
    .refine((s) => new Date(s) <= eighteenYearsAgo(), "You must be 18 or older to join")
    .optional(),
  gender: z.string().transform(canonicalGender).pipe(z.enum(GENDERS)).nullable().optional(),
  roles: z.array(z.enum(ACCEPTED_KINK_ROLES)).max(10).optional(),
  relationshipStatus: z.enum(RELATIONSHIP_STATUSES).nullable().optional(),
  lookingFor: z.array(z.enum(LOOKING_FOR)).max(10).optional(),
  interests: z.array(z.enum(KINKS)).max(20).optional(),
  orientation: z.string().trim().min(1).max(40).nullable().optional(),
  bodyType: z.string().trim().min(1).max(40).nullable().optional(),
  languages: z.array(z.enum(LANGUAGES)).max(10).optional(),
  location: z.string().trim().min(1).max(120).nullable().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, "phone must be E.164, e.g. +2348012345678")
    .nullable()
    .optional(),
  avatarKey: z.string().trim().max(256).nullable().optional(),
  coverKey: z.string().trim().max(256).nullable().optional(),
  nationality: isoCountry.nullable().optional(),
  occupation: z.string().trim().min(1).max(80).nullable().optional(),
  limits: z.string().trim().max(500).nullable().optional(),
  socialLinks: socialLinksSchema.optional(),
  profileVisibility: z.enum(PROFILE_VISIBILITIES).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Same rule as the Better Auth username plugin config (3–30, letters/digits/_/.). */
export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
export const USERNAME_RULES =
  "Usernames are 3–30 characters: letters, numbers, dots and underscores.";

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

const COOLDOWN_MS = NAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/**
 * 30-day lock on display name / username changes (CEO brief): the date the next change
 * is allowed, or null when a change is allowed right now.
 */
export function nextAllowedChange(changedAt: Date | null | undefined, now = new Date()) {
  if (!changedAt) return null;
  const next = new Date(changedAt.getTime() + COOLDOWN_MS);
  return next > now ? next : null;
}

const shortDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export const lockMessage = (field: "display name" | "username", next: Date) =>
  `You can change your ${field} again on ${shortDate(next)}.`;

/** Postgres unique-violation, possibly wrapped by drizzle in a DrizzleQueryError. */
const isUniqueViolation = (e: unknown): boolean => {
  const code = (e as { code?: string; cause?: { code?: string } } | null)?.code;
  const causeCode = (e as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505" || causeCode === "23505";
};

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  async getOwn(userId: string, fallbackName: string) {
    return this.toVM(await this.ensureRow(userId, fallbackName));
  }

  async updateOwn(
    userId: string,
    input: UpdateProfileInput,
    fallbackName: string,
    now = new Date(),
  ) {
    const current = await this.ensureRow(userId, fallbackName);
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
    const changes: Partial<typeof profile.$inferInsert> = { ...input };
    if (input.displayName !== undefined && input.displayName !== current.displayName) {
      const next = nextAllowedChange(current.displayNameChangedAt, now);
      if (next) throw new BadRequestException({ displayName: [lockMessage("display name", next)] });
      changes.displayNameChangedAt = now;
    }
    const [row] = await this.db
      .update(profile)
      .set(changes)
      .where(eq(profile.userId, userId))
      .returning();
    // A new photo joins the member's media history (Media tab); replacing it never deletes the old one.
    const uploads = (["avatarKey", "coverKey"] as const)
      .filter((field) => input[field] && input[field] !== current[field])
      .map((field) => ({
        userId,
        kind: (field === "avatarKey" ? "avatar" : "cover") as "avatar" | "cover",
        key: input[field] as string,
      }));
    if (uploads.length > 0) await this.db.insert(profileMedia).values(uploads);
    return this.toVM(row);
  }

  /**
   * Delete one of your own photos (Media tab → tap → delete). Removes the object and its
   * stored sizes; if it was the current avatar/cover the profile falls back to none.
   */
  async deleteMedia(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(profileMedia)
      .where(and(eq(profileMedia.id, id), eq(profileMedia.userId, userId)));
    if (!row) throw new NotFoundException("Photo not found.");
    await this.db.delete(profileMedia).where(eq(profileMedia.id, row.id));
    const [current] = await this.db.select().from(profile).where(eq(profile.userId, userId));
    const clears: Partial<typeof profile.$inferInsert> = {};
    if (row.kind === "avatar" && current?.avatarKey === row.key) clears.avatarKey = null;
    if (row.kind === "cover" && current?.coverKey === row.key) clears.coverKey = null;
    let updated = current;
    if (Object.keys(clears).length > 0) {
      [updated] = await this.db
        .update(profile)
        .set(clears)
        .where(eq(profile.userId, userId))
        .returning();
    }
    // Best effort — a leftover object costs cents; a failed delete must not fail the request.
    await Promise.all(
      [row.key, ...IMAGE_VARIANTS.map((v) => variantKey(row.key, v))].map((k) =>
        this.storage.remove(k),
      ),
    );
    return { deleted: row.id, profile: await this.toVM(updated) };
  }

  /**
   * Username lives on the auth `user` row (Better Auth username plugin: lowercase
   * `username` for lookups, `displayUsername` as typed). Changes are allowed once every
   * 30 days; a taken handle is a 409.
   */
  async changeUsername(userId: string, requested: string, now = new Date()) {
    const displayUsername = requested.trim().replace(/^@/, "");
    if (!USERNAME_RE.test(displayUsername)) {
      throw new BadRequestException({ username: [USERNAME_RULES] });
    }
    const [account] = await this.db
      .select({ username: user.username, displayUsername: user.displayUsername, name: user.name })
      .from(user)
      .where(eq(user.id, userId));
    if (!account) throw new NotFoundException("Account not found.");
    const row = await this.ensureRow(userId, account.name);
    const username = displayUsername.toLowerCase();
    const unchanged =
      account.username === username &&
      (account.displayUsername ?? account.username) === displayUsername;
    if (unchanged) return this.usernameVM(username, displayUsername, row.usernameChangedAt, now);

    const next = nextAllowedChange(row.usernameChangedAt, now);
    if (next) throw new BadRequestException({ username: [lockMessage("username", next)] });
    try {
      await this.db.transaction(async (tx) => {
        await tx.update(user).set({ username, displayUsername }).where(eq(user.id, userId));
        await tx.update(profile).set({ usernameChangedAt: now }).where(eq(profile.userId, userId));
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException({ username: ["That username is already taken."] });
      }
      throw e;
    }
    return this.usernameVM(username, displayUsername, now, now);
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

  /** Profile is created at signup; upsert covers accounts predating that hook. */
  private async ensureRow(userId: string, fallbackName: string) {
    const [row] = await this.db.select().from(profile).where(eq(profile.userId, userId));
    if (row) return row;
    const [created] = await this.db
      .insert(profile)
      .values({ userId, displayName: fallbackName })
      .onConflictDoNothing()
      .returning();
    return created;
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

  private usernameVM(
    username: string,
    displayUsername: string,
    changedAt: Date | null | undefined,
    now: Date,
  ) {
    return {
      username,
      displayUsername,
      usernameChangedAt: changedAt?.toISOString() ?? null,
      canChangeUsernameAt: nextAllowedChange(changedAt, now)?.toISOString() ?? null,
    };
  }

  private async toVM(row: typeof profile.$inferSelect, now = new Date()) {
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
      nationality: row.nationality ?? null,
      occupation: row.occupation ?? null,
      limits: row.limits ?? null,
      socialLinks: row.socialLinks ?? {},
      profileVisibility: row.profileVisibility ?? "public",
      displayNameChangedAt: row.displayNameChangedAt?.toISOString() ?? null,
      /** null = a change is allowed now; otherwise the date the 30-day lock lifts. */
      canChangeDisplayNameAt:
        nextAllowedChange(row.displayNameChangedAt, now)?.toISOString() ?? null,
      usernameChangedAt: row.usernameChangedAt?.toISOString() ?? null,
      canChangeUsernameAt: nextAllowedChange(row.usernameChangedAt, now)?.toISOString() ?? null,
      updatedAt: row.updatedAt,
    };
  }
}
