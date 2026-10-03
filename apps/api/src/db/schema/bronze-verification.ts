import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export type BronzeStatus =
  | "not_started"
  | "pending"
  | "failed"
  | "manual_review"
  | "verified"
  /** Turned down on the last attempt: only support can reopen it. */
  | "rejected"
  /** Taken away by an admin. */
  | "revoked";
export type BronzeAttemptStatus =
  "started" | "processing" | "failed" | "manual_review" | "verified";

/** The audit of one paid profile-photo comparison; never the images themselves. */
export interface ProfileMatchAudit {
  outcome: "matched" | "review";
  reason: string | null;
  mode: string;
  threshold: number;
  score: number | null;
  requestId: string | null;
  providerStatus: string | null;
}

const at = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

/**
 * A member's identity verification. Holds outcomes only: no ID number, document,
 * selfie or raw provider callback is stored anywhere in these tables.
 */
export const bronzeVerification = pgTable("bronze_verification", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").$type<BronzeStatus>().notNull().default("not_started"),
  /** Failed attempts since the last success; the third ends automated tries. */
  attemptsUsed: integer("attempts_used").notNull().default(0),
  currentAttemptId: uuid("current_attempt_id").references((): AnyPgColumn => bronzeAttempt.id, {
    onDelete: "set null",
  }),
  verifiedAt: at("verified_at"),
  /** The profile as it was verified: change any of these and the badge comes off. */
  verifiedAvatarKey: text("verified_avatar_key"),
  verifiedDob: text("verified_dob"),
  verifiedGender: text("verified_gender"),
  updatedAt: at("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const bronzeAttempt = pgTable(
  "bronze_verification_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    provider: text("provider").notNull().default("didit"),
    providerJobId: text("provider_job_id").notNull().unique(),
    status: text("status").$type<BronzeAttemptStatus>().notNull().default("started"),
    /** The profile the attempt checks against, as it was when it started. */
    avatarKey: text("avatar_key").notNull(),
    profileDob: text("profile_dob").notNull(),
    profileGender: text("profile_gender").notNull(),
    profileCountry: text("profile_country").notNull(),
    profileNationality: text("profile_nationality"),
    /** Derived pass/fail outcomes only. */
    checks: jsonb("checks").$type<Record<string, boolean>>().notNull().default({}),
    failureCodes: jsonb("failure_codes").$type<string[]>().notNull().default([]),
    /**
     * A keyed one-way fingerprint of the verified legal name, birth date and
     * gender. Finds one person verifying a second account; can't be reversed.
     */
    identityBinding: text("identity_binding"),
    /** When the background check last asked Didit about this attempt. */
    reconciledAt: at("reconciled_at"),
    createdAt: at("created_at").defaultNow().notNull(),
    completedAt: at("completed_at"),
  },
  (t) => [
    uniqueIndex("bronze_attempt_user_number_unique").on(t.userId, t.number),
    index("bronze_attempt_open_idx").on(t.status, t.createdAt),
    index("bronze_attempt_binding_idx")
      .on(t.identityBinding)
      .where(sql`${t.identityBinding} is not null`),
  ],
);

export const bronzeConsent = pgTable(
  "bronze_verification_consent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    policyVersion: text("policy_version").notNull(),
    acceptedAt: at("accepted_at").defaultNow().notNull(),
    withdrawnAt: at("withdrawn_at"),
  },
  (t) => [
    // One standing consent per notice version; withdrawn ones stay on record.
    uniqueIndex("bronze_consent_active_unique")
      .on(t.userId, t.policyVersion)
      .where(sql`${t.withdrawnAt} is null`),
  ],
);

/** Durable single-call claim for the paid comparison, and its audit. */
export const bronzeProfileMatch = pgTable("bronze_profile_match", {
  attemptId: uuid("attempt_id")
    .primaryKey()
    .references(() => bronzeAttempt.id, { onDelete: "cascade" }),
  result: jsonb("result").$type<ProfileMatchAudit>(),
  startedAt: at("started_at").defaultNow().notNull(),
  completedAt: at("completed_at"),
});

/** Makes a repeated provider callback a no-op; holds no payload. */
export const bronzeCallback = pgTable(
  "bronze_verification_callback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => bronzeAttempt.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull().unique(),
    resultCode: text("result_code"),
    receivedAt: at("received_at").defaultNow().notNull(),
  },
  (t) => [index("bronze_callback_attempt_idx").on(t.attemptId)],
);

export const bronzeReview = pgTable(
  "bronze_verification_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .unique()
      .references(() => bronzeAttempt.id, { onDelete: "cascade" }),
    reasonCodes: jsonb("reason_codes").$type<string[]>().notNull().default([]),
    status: text("status")
      .$type<"open" | "approved" | "rejected" | "withdrawn">()
      .notNull()
      .default("open"),
    reviewerId: text("reviewer_id").references(() => user.id, { onDelete: "set null" }),
    evidenceReference: text("evidence_reference"),
    decisionReason: text("decision_reason"),
    createdAt: at("created_at").defaultNow().notNull(),
    decidedAt: at("decided_at"),
  },
  (t) => [
    index("bronze_review_open_idx").on(t.status, t.createdAt),
    index("bronze_review_user_idx").on(t.userId),
    index("bronze_review_reviewer_idx").on(t.reviewerId),
  ],
);
