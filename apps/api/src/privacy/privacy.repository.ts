import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import { profile, profilePrivacy } from "../db/schema";
import type { PrivacySettings } from "./privacy-policy";

@Injectable()
export class PrivacyRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}
  async read(userId: string) {
    const [row] = await this.db
      .select({ settings: profilePrivacy.settings, legacy: profile.profileVisibility })
      .from(profile)
      .leftJoin(profilePrivacy, eq(profilePrivacy.userId, profile.userId))
      .where(eq(profile.userId, userId))
      .limit(1);
    return row ?? null;
  }
  async patch(userId: string, patch: PrivacySettings) {
    // Merge only touched keys, so simultaneous updates from two devices do not overwrite each other.
    await this.db
      .insert(profilePrivacy)
      .values({ userId, settings: patch })
      .onConflictDoUpdate({
        target: profilePrivacy.userId,
        set: {
          settings: sql`${profilePrivacy.settings} || ${JSON.stringify(patch)}::jsonb`,
          updatedAt: new Date(),
        },
      });
    return this.read(userId);
  }
}
