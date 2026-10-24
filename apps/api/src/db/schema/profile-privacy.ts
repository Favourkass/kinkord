import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import type { PrivacySettings } from "../../privacy/privacy-policy";

export const profilePrivacy = pgTable("profile_privacy", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  settings: jsonb("settings").$type<PrivacySettings>().notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
