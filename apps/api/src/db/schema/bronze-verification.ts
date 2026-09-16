import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export type BronzeStatus = "not_started" | "pending" | "failed" | "manual_review" | "verified";
export type BronzeAttemptStatus = "started" | "processing" | "failed" | "manual_review" | "verified";

/** No raw ID number, government document, selfie, or provider callback is persisted here. */
export const bronzeVerification = pgTable("bronze_verification", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  status: text("status").$type<BronzeStatus>().notNull().default("not_started"),
  attemptsUsed: integer("attempts_used").notNull().default(0),
  currentAttemptId: uuid("current_attempt_id"),
  verifiedAt: timestamp("verified_at"),
  verifiedAvatarKey: text("verified_avatar_key"),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const bronzeAttempt = pgTable("bronze_verification_attempt", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  provider: text("provider").notNull().default("smile_id"),
  providerJobId: text("provider_job_id").notNull().unique(),
  status: text("status").$type<BronzeAttemptStatus>().notNull().default("started"),
  avatarKey: text("avatar_key").notNull(),
  profileDob: text("profile_dob").notNull(),
  profileGender: text("profile_gender").notNull(),
  profileCountry: text("profile_country").notNull(),
  /** Only derived check outcomes, never document/biometric images or raw ID PII. */
  checks: jsonb("checks").$type<Record<string, boolean>>().notNull().default({}),
  failureCodes: jsonb("failure_codes").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (t) => [uniqueIndex("bronze_attempt_user_number_unique").on(t.userId, t.number), index("bronze_attempt_user_idx").on(t.userId)]);

export const bronzeConsent = pgTable("bronze_verification_consent", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  policyVersion: text("policy_version").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
}, (t) => [index("bronze_consent_user_idx").on(t.userId, t.acceptedAt)]);

/** Minimal idempotency/audit record; do not store Smile's raw PII-bearing callback. */
export const bronzeCallback = pgTable("bronze_verification_callback", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => bronzeAttempt.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull().unique(),
  resultCode: text("result_code"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export const bronzeReview = pgTable("bronze_verification_review", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  attemptId: uuid("attempt_id").notNull().unique().references(() => bronzeAttempt.id, { onDelete: "cascade" }),
  reasonCodes: jsonb("reason_codes").$type<string[]>().notNull().default([]),
  status: text("status").$type<"open" | "approved" | "rejected">().notNull().default("open"),
  reviewerId: text("reviewer_id").references(() => user.id),
  evidenceReference: text("evidence_reference"),
  decisionReason: text("decision_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
});
