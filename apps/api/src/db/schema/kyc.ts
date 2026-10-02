import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export type KycCaseStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_user_action"
  | "under_review"
  | "verified"
  | "failed"
  | "expired"
  | "revoked";
export type KycStage = "identity" | "location" | "residence" | "financial";
export type KycStageStatus =
  "not_started" | "pending" | "passed" | "failed" | "under_review" | "unavailable" | "expired";
export type KycActorType = "member" | "system" | "reviewer";
export type KycConsentCategory = "identity_biometric" | "location" | "residence" | "financial";
export type KycReviewStatus = "open" | "approved" | "rejected" | "superseded";

/**
 * The KYC aggregate stores only decisions and references. It deliberately has
 * no raw government-ID, selfie, video, document, GPS coordinate or bank-data
 * column; providers or an approved protected-evidence store own that material.
 */
export const kycCase = pgTable("kyc_case", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").$type<KycCaseStatus>().notNull().default("not_started"),
  policyVersion: text("policy_version"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** Each provider session is scoped to one KYC stage and contains no provider payload. */
export const kycAttempt = pgTable(
  "kyc_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseUserId: text("case_user_id")
      .notNull()
      .references(() => kycCase.userId, { onDelete: "cascade" }),
    stage: text("stage").$type<KycStage>().notNull(),
    provider: text("provider").notNull(),
    providerSessionReference: text("provider_session_reference").notNull().unique(),
    status: text("status").$type<KycStageStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("kyc_attempt_case_stage_idx").on(table.caseUserId, table.stage),
    index("kyc_attempt_status_idx").on(table.status),
  ],
);

/**
 * Derived results only. `summary` must be a redacted allow-listed map of
 * outcomes/codes, never an ID number, document, GPS coordinate or bank detail.
 */
export const kycStageResult = pgTable(
  "kyc_stage_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseUserId: text("case_user_id")
      .notNull()
      .references(() => kycCase.userId, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id").references(() => kycAttempt.id, { onDelete: "set null" }),
    stage: text("stage").$type<KycStage>().notNull(),
    status: text("status").$type<KycStageStatus>().notNull(),
    provider: text("provider"),
    providerReference: text("provider_reference"),
    summary: jsonb("summary")
      .$type<Record<string, boolean | number | string>>()
      .notNull()
      .default({}),
    reasonCodes: jsonb("reason_codes").$type<string[]>().notNull().default([]),
    assessedAt: timestamp("assessed_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("kyc_stage_result_case_stage_idx").on(table.caseUserId, table.stage, table.assessedAt),
    uniqueIndex("kyc_stage_result_attempt_stage_unique").on(table.attemptId, table.stage),
  ],
);

/** Consent is separately versioned by sensitive data category and remains auditable. */
export const kycConsent = pgTable(
  "kyc_consent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseUserId: text("case_user_id")
      .notNull()
      .references(() => kycCase.userId, { onDelete: "cascade" }),
    category: text("category").$type<KycConsentCategory>().notNull(),
    policyVersion: text("policy_version").notNull(),
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
    withdrawnAt: timestamp("withdrawn_at"),
  },
  (table) => [
    uniqueIndex("kyc_consent_case_category_version_unique").on(
      table.caseUserId,
      table.category,
      table.policyVersion,
    ),
    index("kyc_consent_case_idx").on(table.caseUserId, table.acceptedAt),
  ],
);

/** An append-only, redacted trail for sensitive KYC state changes and reviewer actions. */
export const kycAuditEvent = pgTable(
  "kyc_audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseUserId: text("case_user_id")
      .notNull()
      .references(() => kycCase.userId, { onDelete: "cascade" }),
    actorType: text("actor_type").$type<KycActorType>().notNull(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, boolean | number | string>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("kyc_audit_case_created_idx").on(table.caseUserId, table.createdAt)],
);

/**
 * A reviewer task carries derived codes and provider references only. Reviewers
 * inspect protected evidence in the authorised provider console, never here.
 */
export const kycReview = pgTable(
  "kyc_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseUserId: text("case_user_id")
      .notNull()
      .references(() => kycCase.userId, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id").references(() => kycAttempt.id, { onDelete: "set null" }),
    stage: text("stage").$type<KycStage>().notNull(),
    reasonCodes: jsonb("reason_codes").$type<string[]>().notNull().default([]),
    status: text("status").$type<KycReviewStatus>().notNull().default("open"),
    reviewerId: text("reviewer_id").references(() => user.id, { onDelete: "set null" }),
    evidenceReference: text("evidence_reference"),
    decisionReason: text("decision_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    decidedAt: timestamp("decided_at"),
  },
  (table) => [
    uniqueIndex("kyc_review_attempt_stage_unique").on(table.attemptId, table.stage),
    index("kyc_review_open_idx").on(table.status, table.createdAt),
  ],
);
