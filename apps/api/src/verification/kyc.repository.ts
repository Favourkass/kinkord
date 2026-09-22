import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import { bronzeVerification, kycAttempt, kycAuditEvent, kycCase, kycConsent, kycReview, kycStageResult, profile, type KycConsentCategory, type KycStage, type KycStageStatus } from "../db/schema";
import { kycProviderEnvironment } from "./kyc-policy";

@Injectable()
export class KycRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** A case is created lazily, before any sensitive evidence can be recorded. */
  async snapshot(userId: string) {
    await this.db.insert(kycCase).values({ userId }).onConflictDoNothing();
    const [caseRow] = await this.db.select().from(kycCase).where(eq(kycCase.userId, userId));
    const results = await this.db.select().from(kycStageResult)
      .where(eq(kycStageResult.caseUserId, userId)).orderBy(desc(kycStageResult.assessedAt));
    return { caseRow, results };
  }

  /** Consent cannot overwrite an earlier version or erase a withdrawal record. */
  async recordConsent(input: { userId: string; category: KycConsentCategory; policyVersion: string }) {
    return this.db.transaction(async (tx) => {
      await tx.insert(kycCase).values({ userId: input.userId }).onConflictDoNothing();
      const [record] = await tx.insert(kycConsent).values({
        caseUserId: input.userId, category: input.category, policyVersion: input.policyVersion,
      }).onConflictDoNothing().returning();
      return record ?? null;
    });
  }

  async upsertDerivedStageResult(input: {
    userId: string; attemptId: string; stage: KycStage; provider: string; providerReference: string;
    status: KycStageStatus; summary: Record<string, boolean | number | string>; reasonCodes: string[];
  }) {
    return this.db.transaction(async (tx) => {
      await tx.insert(kycCase).values({ userId: input.userId }).onConflictDoNothing();
      const [existingReview] = await tx.select().from(kycReview).where(and(
        eq(kycReview.attemptId, input.attemptId), eq(kycReview.stage, input.stage),
      )).for("update");
      // A later/replayed provider callback must never overwrite a human's final decision.
      if (existingReview && existingReview.status !== "open" && existingReview.status !== "superseded") {
        const [existing] = await tx.select().from(kycStageResult).where(and(
          eq(kycStageResult.attemptId, input.attemptId), eq(kycStageResult.stage, input.stage),
        )).limit(1);
        return existing ?? null;
      }
      const [currentAttempt] = await tx.select({ createdAt: kycAttempt.createdAt })
        .from(kycAttempt).where(eq(kycAttempt.id, input.attemptId));
      // An older attempt's late callback must never shadow a newer attempt's result.
      if (currentAttempt) {
        const [newerAttempt] = await tx.select({ id: kycAttempt.id }).from(kycAttempt).where(and(
          eq(kycAttempt.caseUserId, input.userId), eq(kycAttempt.stage, input.stage),
        )).orderBy(desc(kycAttempt.createdAt)).limit(1);
        if (newerAttempt && newerAttempt.id !== input.attemptId) {
          const [existing] = await tx.select().from(kycStageResult).where(and(
            eq(kycStageResult.caseUserId, input.userId), eq(kycStageResult.stage, input.stage),
          )).orderBy(desc(kycStageResult.assessedAt)).limit(1);
          return existing ?? null;
        }
      }
      const summary = { ...input.summary, environment: kycProviderEnvironment() };
      const [existingResult] = await tx.select().from(kycStageResult).where(and(
        eq(kycStageResult.attemptId, input.attemptId), eq(kycStageResult.stage, input.stage),
      )).limit(1);
      // A replayed or out-of-order webhook must not downgrade an automated pass.
      if (existingResult?.status === "passed" && input.status !== "passed") return existingResult;
      const [result] = await tx.insert(kycStageResult).values({
        caseUserId: input.userId, attemptId: input.attemptId, stage: input.stage,
        provider: input.provider, providerReference: input.providerReference,
        status: input.status, summary, reasonCodes: input.reasonCodes,
      }).onConflictDoUpdate({
        target: [kycStageResult.attemptId, kycStageResult.stage],
        set: { status: input.status, summary, reasonCodes: input.reasonCodes, assessedAt: new Date() },
      }).returning();
      await tx.insert(kycAuditEvent).values({
        caseUserId: input.userId, actorType: "system", eventType: `stage.${input.stage}.${input.status}`,
        metadata: { provider: input.provider, reasonCount: input.reasonCodes.length },
      });
      await tx.update(kycAttempt).set({
        status: input.status,
        completedAt: input.status === "pending" ? null : new Date(),
      }).where(eq(kycAttempt.id, input.attemptId));
      // Identity review remains in the specialised legacy flow while its
      // profile-face migration is in progress. Other KYC stages use this
      // generic, role-protected queue.
      if (input.status === "under_review" && input.stage !== "identity") {
        await tx.insert(kycReview).values({
          caseUserId: input.userId, attemptId: input.attemptId, stage: input.stage,
          reasonCodes: input.reasonCodes,
        }).onConflictDoUpdate({
          target: [kycReview.attemptId, kycReview.stage],
          set: { status: "open", reasonCodes: input.reasonCodes, reviewerId: null,
            evidenceReference: null, decisionReason: null, decidedAt: null },
        });
      } else if (existingReview?.status === "open") {
        await tx.update(kycReview).set({ status: "superseded", decidedAt: new Date() })
          .where(eq(kycReview.id, existingReview.id));
      }
      return result;
    });
  }

  /** Bridges a legacy provider session into the new KYC aggregate exactly once. */
  async ensureProviderAttempt(input: { id: string; userId: string; provider: string; providerReference: string }) {
    return this.db.transaction(async (tx) => {
      await tx.insert(kycCase).values({ userId: input.userId }).onConflictDoNothing();
      await tx.insert(kycAttempt).values({
        id: input.id, caseUserId: input.userId, stage: "identity", provider: input.provider,
        providerSessionReference: input.providerReference, status: "pending",
      }).onConflictDoNothing();
    });
  }

  /** Reserves a provider reference before we direct a member to a hosted flow. */
  async createProviderAttempt(input: { userId: string; stage: KycStage; provider: string; providerReference: string }) {
    return this.db.transaction(async (tx) => {
      await tx.insert(kycCase).values({ userId: input.userId }).onConflictDoNothing();
      await tx.select({ userId: kycCase.userId }).from(kycCase)
        .where(eq(kycCase.userId, input.userId)).for("update");
      // Abandoned hosted sessions cannot lock a stage; expire them like Bronze does.
      const [stale] = await tx.select({ id: kycAttempt.id }).from(kycAttempt).where(and(
        eq(kycAttempt.caseUserId, input.userId), eq(kycAttempt.stage, input.stage),
        eq(kycAttempt.status, "pending"),
      ));
      if (stale) {
        const [attempt] = await tx.select({ createdAt: kycAttempt.createdAt }).from(kycAttempt)
          .where(eq(kycAttempt.id, stale.id));
        if (attempt && attempt.createdAt.getTime() <= Date.now() - 24 * 60 * 60 * 1000) {
          await tx.update(kycAttempt).set({ status: "failed", completedAt: new Date() })
            .where(eq(kycAttempt.id, stale.id));
          await tx.insert(kycAuditEvent).values({
            caseUserId: input.userId, actorType: "system", eventType: `stage.${input.stage}.failed`,
            metadata: { provider: input.provider, reason: "SESSION_EXPIRED" },
          });
        } else {
          return null;
        }
      }
      const [pending] = await tx.select({ id: kycAttempt.id }).from(kycAttempt).where(and(
        eq(kycAttempt.caseUserId, input.userId), eq(kycAttempt.stage, input.stage), eq(kycAttempt.status, "pending"),
      )).limit(1);
      if (pending) return null;
      const id = randomUUID();
      await tx.insert(kycAttempt).values({
        id, caseUserId: input.userId, stage: input.stage, provider: input.provider,
        providerSessionReference: input.providerReference, status: "pending",
      });
      await tx.insert(kycAuditEvent).values({
        caseUserId: input.userId, actorType: "member", eventType: `stage.${input.stage}.started`,
        metadata: { provider: input.provider },
      });
      return { id, ...input };
    });
  }

  async attemptByProviderReference(providerReference: string, stage: KycStage) {
    const [attempt] = await this.db.select().from(kycAttempt).where(and(
      eq(kycAttempt.providerSessionReference, providerReference), eq(kycAttempt.stage, stage),
    )).limit(1);
    return attempt ?? null;
  }

  async latestStageAttempt(userId: string, stage: KycStage) {
    const [attempt] = await this.db.select().from(kycAttempt).where(and(
      eq(kycAttempt.caseUserId, userId), eq(kycAttempt.stage, stage),
    )).orderBy(desc(kycAttempt.createdAt)).limit(1);
    return attempt ?? null;
  }

  /**
   * These are already Kinkord's identity-stage comparison attributes. Mono's
   * raw identity response is compared in memory and is deliberately not saved.
   */
  async financialComparisonSnapshot(userId: string) {
    const [currentIdentity] = await this.db.select({
      status: bronzeVerification.status, verifiedAvatarKey: bronzeVerification.verifiedAvatarKey,
      currentAvatarKey: profile.avatarKey,
    }).from(bronzeVerification).innerJoin(profile, eq(profile.userId, bronzeVerification.userId))
      .where(eq(bronzeVerification.userId, userId)).limit(1);
    if (currentIdentity?.status !== "verified" || !currentIdentity.verifiedAvatarKey ||
        currentIdentity.verifiedAvatarKey !== currentIdentity.currentAvatarKey) return null;
    const [identity] = await this.db.select({ summary: kycStageResult.summary })
      .from(kycStageResult).where(and(eq(kycStageResult.caseUserId, userId),
        eq(kycStageResult.stage, "identity"), eq(kycStageResult.status, "passed")))
      .orderBy(desc(kycStageResult.assessedAt)).limit(1);
    const identityBinding = identity?.summary?.identityBinding;
    return typeof identityBinding === "string" ? { identityBinding } : null;
  }

  async failProviderAttempt(attemptId: string, reason: string) {
    await this.db.transaction(async (tx) => {
      const [attempt] = await tx.update(kycAttempt).set({ status: "failed", completedAt: new Date() })
        .where(eq(kycAttempt.id, attemptId)).returning();
      if (attempt) await tx.insert(kycAuditEvent).values({
        caseUserId: attempt.caseUserId, actorType: "system", eventType: `stage.${attempt.stage}.failed`,
        metadata: { provider: attempt.provider, reason },
      });
    });
  }

  async recordProviderReceipt(input: { userId: string; stage: KycStage; provider: string; event: string }) {
    await this.db.insert(kycAuditEvent).values({
      caseUserId: input.userId, actorType: "system", eventType: `provider.${input.provider}.${input.event}`,
      metadata: { stage: input.stage },
    });
  }

  async openKycReviews() {
    return this.db.select({
      id: kycReview.id, caseUserId: kycReview.caseUserId, attemptId: kycReview.attemptId,
      stage: kycReview.stage, reasonCodes: kycReview.reasonCodes, createdAt: kycReview.createdAt,
      provider: kycAttempt.provider, providerReference: kycAttempt.providerSessionReference,
      summary: kycStageResult.summary,
    }).from(kycReview)
      .leftJoin(kycAttempt, eq(kycAttempt.id, kycReview.attemptId))
      .leftJoin(kycStageResult, and(eq(kycStageResult.attemptId, kycReview.attemptId), eq(kycStageResult.stage, kycReview.stage)))
      .where(and(eq(kycReview.status, "open"), eq(kycStageResult.status, "under_review")))
      .orderBy(kycReview.createdAt).limit(50);
  }

  async kycReviewContext(id: string) {
    const [row] = await this.db.select({
      id: kycReview.id, caseUserId: kycReview.caseUserId, attemptId: kycReview.attemptId,
      stage: kycReview.stage, status: kycReview.status, resultId: kycStageResult.id,
      resultStatus: kycStageResult.status, summary: kycStageResult.summary,
      assessedAt: kycStageResult.assessedAt,
    }).from(kycReview).leftJoin(kycStageResult, and(
      eq(kycStageResult.attemptId, kycReview.attemptId), eq(kycStageResult.stage, kycReview.stage),
    )).where(eq(kycReview.id, id)).limit(1);
    return row ?? null;
  }

  async decideKycReview(input: { id: string; reviewerId: string; decision: "approve" | "reject"; evidenceReference: string; reason: string;
    expectedResultId: string; expectedAssessedAt: Date }) {
    return this.db.transaction(async (tx) => {
      const [review] = await tx.select().from(kycReview).where(eq(kycReview.id, input.id)).for("update");
      if (!review || review.status !== "open" || !review.attemptId) return null;
      const [result] = await tx.select().from(kycStageResult).where(and(
        eq(kycStageResult.attemptId, review.attemptId), eq(kycStageResult.stage, review.stage),
      )).orderBy(desc(kycStageResult.assessedAt)).limit(1);
      if (!result || result.id !== input.expectedResultId || result.status !== "under_review" ||
          result.assessedAt.getTime() !== input.expectedAssessedAt.getTime()) return null;
      const status = input.decision === "approve" ? "passed" as const : "failed" as const;
      await tx.update(kycReview).set({
        status: input.decision === "approve" ? "approved" : "rejected", reviewerId: input.reviewerId,
        evidenceReference: input.evidenceReference, decisionReason: input.reason, decidedAt: new Date(),
      }).where(eq(kycReview.id, review.id));
      await tx.update(kycStageResult).set({
        status, reasonCodes: [...review.reasonCodes, input.decision === "approve" ? "MANUAL_REVIEW_APPROVED" : "MANUAL_REVIEW_REJECTED"],
        assessedAt: new Date(),
      }).where(eq(kycStageResult.id, result.id));
      await tx.update(kycAttempt).set({ status, completedAt: new Date() }).where(eq(kycAttempt.id, review.attemptId));
      await tx.insert(kycAuditEvent).values({
        caseUserId: review.caseUserId, actorType: "reviewer", actorId: input.reviewerId,
        eventType: `review.${review.stage}.${input.decision}`, metadata: { reasonCount: review.reasonCodes.length },
      });
      return { status };
    });
  }

  async hasActiveConsent(userId: string, category: KycConsentCategory, policyVersion: string) {
    const [record] = await this.db.select({ id: kycConsent.id }).from(kycConsent).where(and(
      eq(kycConsent.caseUserId, userId), eq(kycConsent.category, category),
      eq(kycConsent.policyVersion, policyVersion), isNull(kycConsent.withdrawnAt),
    )).orderBy(desc(kycConsent.acceptedAt)).limit(1);
    return Boolean(record);
  }


  async resolveLegacyIdentityReview(input: { userId: string; attemptId: string; approved: boolean; profileFaceMatches: boolean }) {
    return this.db.transaction(async (tx) => {
      const [result] = await tx.select().from(kycStageResult).where(and(
        eq(kycStageResult.caseUserId, input.userId), eq(kycStageResult.attemptId, input.attemptId),
        eq(kycStageResult.stage, "identity"),
      )).for("update");
      if (!result) return null;
      const summary: Record<string, boolean | number | string> = {
        ...result.summary, profileFace: input.profileFaceMatches,
        environment: result.summary.environment ?? kycProviderEnvironment(),
      };
      const identityChecksPass = summary.governmentId === true && summary.liveness === true &&
        summary.idFace === true && summary.profileFace === true && summary.identityDetails === true;
      const status = input.approved && identityChecksPass ? "passed" as const : "failed" as const;
      await tx.update(kycStageResult).set({
        status, summary, reasonCodes: [input.approved && !identityChecksPass
          ? "IDENTITY_REVIEW_REQUIRED_CHECK_MISSING" : input.approved
            ? "MANUAL_REVIEW_APPROVED" : "MANUAL_REVIEW_REJECTED"], assessedAt: new Date(),
      }).where(eq(kycStageResult.id, result.id));
      await tx.update(kycAttempt).set({ status, completedAt: new Date() }).where(eq(kycAttempt.id, input.attemptId));
      await tx.insert(kycAuditEvent).values({
        caseUserId: input.userId, actorType: "system", eventType: `stage.identity.${status}`,
        metadata: { source: "legacy_identity_review" },
      });
      return { status };
    });
  }

  async latestDiditResidenceAttempt(userId: string) {
    const [attempt] = await this.db.select().from(kycAttempt).where(and(
      eq(kycAttempt.caseUserId, userId), eq(kycAttempt.provider, "didit"),
    )).orderBy(desc(kycAttempt.createdAt)).limit(1);
    if (!attempt) return null;
    const [residence] = await this.db.select().from(kycStageResult).where(and(
      eq(kycStageResult.caseUserId, userId), eq(kycStageResult.attemptId, attempt.id),
      eq(kycStageResult.stage, "residence"),
    )).orderBy(desc(kycStageResult.assessedAt)).limit(1);
    return residence?.status === "passed" ? attempt : null;
  }
}
