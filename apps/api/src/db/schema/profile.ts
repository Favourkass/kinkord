import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Public persona — deliberately separate from the auth `user` (legal identity).
 * Pseudonymity is a product feature: nothing here needs to match KYC data.
 */
export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  pronouns: text("pronouns"),
  /** ISO 3166-1 alpha-2, from the country-selection onboarding step. */
  country: text("country"),
  /** S3 object key under avatars/; served via presigned GET. */
  avatarKey: text("avatar_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
