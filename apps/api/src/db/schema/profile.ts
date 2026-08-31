import { boolean, date, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
  /** Onboarding step 2 "Tell us about you". */
  state: text("state"),
  city: text("city"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  /** Kink roles picked at step 4; free-form labels. */
  roles: jsonb("roles").$type<string[]>().notNull().default([]),
  relationshipStatus: text("relationship_status"),
  lookingFor: jsonb("looking_for").$type<string[]>().notNull().default([]),
  interests: jsonb("interests").$type<string[]>().notNull().default([]),
  /** Free-text public whereabouts line, e.g. "Sapele, Delta State, Nigeria". */
  location: text("location"),
  /** Collected at signup; unverified until SMS returns. */
  phone: text("phone"),
  /** "Basic verified" gate: flips only via phone OTP once SMS is live. */
  phoneVerified: boolean("phone_verified").notNull().default(false),
  /** S3 object keys; served via presigned GET. */
  avatarKey: text("avatar_key"),
  coverKey: text("cover_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
