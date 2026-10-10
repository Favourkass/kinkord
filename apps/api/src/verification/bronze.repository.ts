import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import {
  bronzeAttempt,
  bronzeCallback,
  bronzeConsent,
  bronzeProfileMatch,
  bronzeReview,
  bronzeVerification,
  profile,
  profileMedia,
  user,
  type BronzeStatus,
} from "../db/schema";
import {
  BRONZE_MAX_ATTEMPTS,
  BRONZE_POLICY_VERSION,
  bronzeCallbackOutcome,
  canAwardBronze,
  emptyBronzeChecks,
  idChecksPass,
  type BronzeChecks,
} from "./bronze-policy";
import type { ProfileMatchAudit } from "./profile-match-policy";

/** The profile an attempt checks against. */
export interface ProfileSnapshot {
  avatarKey: string;
  dob: string;
  gender: string;
  country: string;
  nationality: string | null;
}

/** Where a member lands when an attempt ends without a pass. */
const afterFailure = (attemptsUsed: number): BronzeStatus =>
  attemptsUsed >= BRONZE_MAX_ATTEMPTS ? "rejected" : "failed";

@Injectable()
export class BronzeRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** The profile fields verification compares, and when the current photo was uploaded. */
  async snapshot(userId: string) {
    const [identity] = await this.db
      .select({
        avatarKey: profile.avatarKey,
        dob: profile.dateOfBirth,
        gender: profile.gender,
        country: profile.country,
        nationality: profile.nationality,
      })
      .from(profile)
      .where(eq(profile.userId, userId));
    if (!identity) return null;
    const [photo] = identity.avatarKey
      ? await this.db
          .select({ uploadedAt: profileMedia.createdAt })
          .from(profileMedia)
          .where(
            and(
              eq(profileMedia.userId, userId),
              eq(profileMedia.kind, "avatar"),
              eq(profileMedia.key, identity.avatarKey),
            ),
          )
          .orderBy(desc(profileMedia.createdAt))
          .limit(1)
      : [];
    return { ...identity, avatarUploadedAt: photo?.uploadedAt ?? null };
  }

  /** Read-only: the member's verification as it stands. */
  async state(userId: string) {
    const [row] = await this.db
      .select()
      .from(bronzeVerification)
      .where(eq(bronzeVerification.userId, userId));
    return row ?? null;
  }

  async hasConsent(userId: string) {
    const [row] = await this.db
      .select({ id: bronzeConsent.id })
      .from(bronzeConsent)
      .where(
        and(
          eq(bronzeConsent.userId, userId),
          eq(bronzeConsent.policyVersion, BRONZE_POLICY_VERSION),
          isNull(bronzeConsent.withdrawnAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** At most one standing consent per notice version. */
  async consent(userId: string) {
    await this.db
      .insert(bronzeConsent)
      .values({ userId, policyVersion: BRONZE_POLICY_VERSION })
      .onConflictDoNothing({
        target: [bronzeConsent.userId, bronzeConsent.policyVersion],
        where: sql`${bronzeConsent.withdrawnAt} is null`,
      });
  }

  /**
   * Withdrawing consent ends everything that rested on it: the badge, a check
   * in progress, a waiting review and the identity fingerprint. Returns the
   * member's Didit sessions so the caller can erase them there too.
   */
  async withdrawConsent(userId: string): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      await tx
        .update(bronzeConsent)
        .set({ withdrawnAt: now })
        .where(and(eq(bronzeConsent.userId, userId), isNull(bronzeConsent.withdrawnAt)));
      await tx
        .update(bronzeAttempt)
        .set({ status: "failed", failureCodes: ["CONSENT_WITHDRAWN"], completedAt: now })
        .where(
          and(
            eq(bronzeAttempt.userId, userId),
            inArray(bronzeAttempt.status, ["started", "processing"]),
          ),
        );
      await tx
        .update(bronzeAttempt)
        .set({ identityBinding: null })
        .where(eq(bronzeAttempt.userId, userId));
      await tx
        .update(bronzeReview)
        .set({ status: "withdrawn", decidedAt: now })
        .where(and(eq(bronzeReview.userId, userId), eq(bronzeReview.status, "open")));
      await tx
        .update(bronzeVerification)
        .set({
          status: "not_started",
          currentAttemptId: null,
          verifiedAt: null,
          verifiedAvatarKey: null,
          verifiedDob: null,
          verifiedGender: null,
        })
        .where(
          and(eq(bronzeVerification.userId, userId), ne(bronzeVerification.status, "revoked")),
        );
      return this.diditSessions(tx, userId);
    });
  }

  /** Every Didit session the member ever opened, for erasing at Didit. */
  async diditSessionsOf(userId: string): Promise<string[]> {
    return this.diditSessions(this.db, userId);
  }

  private async diditSessions(db: Pick<Db, "select">, userId: string) {
    const rows = await db
      .select({ jobId: bronzeAttempt.providerJobId })
      .from(bronzeAttempt)
      .where(eq(bronzeAttempt.userId, userId));
    return rows.filter((r) => r.jobId.startsWith("didit:")).map((r) => r.jobId.slice(6));
  }

  /** The row lock serializes simultaneous starts and makes the attempt cap atomic. */
  async reserve(userId: string, snapshot: ProfileSnapshot, jobId: string) {
    return this.db.transaction(async (tx) => {
      await tx.insert(bronzeVerification).values({ userId }).onConflictDoNothing();
      const [state] = await tx
        .select()
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, userId))
        .for("update");
      if (
        ["pending", "manual_review", "rejected", "revoked"].includes(state.status) ||
        state.attemptsUsed >= BRONZE_MAX_ATTEMPTS
      ) {
        return null;
      }
      const [last] = await tx
        .select({ number: max(bronzeAttempt.number) })
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.userId, userId));
      const id = randomUUID();
      await tx.insert(bronzeAttempt).values({
        id,
        userId,
        number: (last?.number ?? 0) + 1,
        providerJobId: jobId,
        avatarKey: snapshot.avatarKey,
        profileDob: snapshot.dob,
        profileGender: snapshot.gender,
        profileCountry: snapshot.country,
        profileNationality: snapshot.nationality,
      });
      await tx
        .update(bronzeVerification)
        .set({ status: "pending", attemptsUsed: state.attemptsUsed + 1, currentAttemptId: id })
        .where(eq(bronzeVerification.userId, userId));
      return id;
    });
  }

  async findAttempt(jobId: string) {
    const [row] = await this.db
      .select()
      .from(bronzeAttempt)
      .where(eq(bronzeAttempt.providerJobId, jobId));
    return row ?? null;
  }

  async attempt(id: string) {
    const [row] = await this.db.select().from(bronzeAttempt).where(eq(bronzeAttempt.id, id));
    return row ?? null;
  }

  /**
   * Claims attempts still waiting on Didit for a background check, at most one
   * API instance each every few minutes. Webhooks get ten minutes first.
   */
  async claimForReconcile(limit: number) {
    const due = this.db
      .select({ id: bronzeAttempt.id })
      .from(bronzeAttempt)
      .where(
        and(
          inArray(bronzeAttempt.status, ["started", "processing"]),
          sql`${bronzeAttempt.createdAt} < now() - interval '10 minutes'`,
          sql`(${bronzeAttempt.reconciledAt} is null or ${bronzeAttempt.reconciledAt} < now() - interval '4 minutes')`,
        ),
      )
      .orderBy(bronzeAttempt.createdAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    return this.db
      .update(bronzeAttempt)
      .set({ reconciledAt: new Date() })
      .where(inArray(bronzeAttempt.id, due))
      .returning({
        id: bronzeAttempt.id,
        providerJobId: bronzeAttempt.providerJobId,
        createdAt: bronzeAttempt.createdAt,
      });
  }

  /** A session Didit never finished: the attempt fails, and counts toward the cap. */
  async expireAttempt(attemptId: string) {
    return this.db.transaction(async (tx) => {
      const [attempt] = await tx
        .select()
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, attemptId))
        .for("update");
      if (!attempt || !["started", "processing"].includes(attempt.status)) return false;
      await tx
        .update(bronzeAttempt)
        .set({ status: "failed", failureCodes: ["SESSION_EXPIRED"], completedAt: new Date() })
        .where(eq(bronzeAttempt.id, attemptId));
      const [state] = await tx
        .select()
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, attempt.userId))
        .for("update");
      if (state?.currentAttemptId === attemptId && state.status === "pending")
        await tx
          .update(bronzeVerification)
          .set({ status: afterFailure(state.attemptsUsed) })
          .where(eq(bronzeVerification.userId, attempt.userId));
      return true;
    });
  }

  /** Whether the same person's ID already verified, or is being reviewed for, another account. */
  async bindingUsedElsewhere(binding: string, userId: string) {
    const [row] = await this.db
      .select({ id: bronzeAttempt.id })
      .from(bronzeAttempt)
      .where(
        and(
          eq(bronzeAttempt.identityBinding, binding),
          ne(bronzeAttempt.userId, userId),
          inArray(bronzeAttempt.status, ["verified", "manual_review"]),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** Unique attempt key claims the paid request across webhooks, polls and API instances. */
  async claimProfileMatch(attemptId: string) {
    const [claimed] = await this.db
      .insert(bronzeProfileMatch)
      .values({ attemptId })
      .onConflictDoNothing()
      .returning();
    if (claimed) return { acquired: true, ...claimed };
    const [existing] = await this.db
      .select()
      .from(bronzeProfileMatch)
      .where(eq(bronzeProfileMatch.attemptId, attemptId));
    return { acquired: false, ...existing };
  }

  async completeProfileMatch(attemptId: string, result: ProfileMatchAudit) {
    await this.db
      .update(bronzeProfileMatch)
      .set({ result, completedAt: new Date() })
      .where(eq(bronzeProfileMatch.attemptId, attemptId));
  }

  /** The admins' queue, oldest first, with who each member is. */
  async openReviews() {
    return this.db
      .select({
        id: bronzeReview.id,
        userId: bronzeReview.userId,
        attemptId: bronzeReview.attemptId,
        reasonCodes: bronzeReview.reasonCodes,
        createdAt: bronzeReview.createdAt,
        providerJobId: bronzeAttempt.providerJobId,
        avatarKey: bronzeAttempt.avatarKey,
        checks: bronzeAttempt.checks,
        username: user.username,
        displayName: profile.displayName,
      })
      .from(bronzeReview)
      .innerJoin(bronzeAttempt, eq(bronzeAttempt.id, bronzeReview.attemptId))
      .innerJoin(user, eq(user.id, bronzeReview.userId))
      .leftJoin(profile, eq(profile.userId, bronzeReview.userId))
      .where(eq(bronzeReview.status, "open"))
      .orderBy(bronzeReview.createdAt)
      .limit(50);
  }

  /**
   * An admin's decision. Approving confirms the two checks a person can judge
   * (the profile photo and the ID's country); what only the ID proves must
   * already have passed. Rejecting fails the attempt, so the member can try
   * again if attempts remain.
   */
  async decideReview(input: {
    id: string;
    reviewerId: string;
    decision: "approve" | "reject";
    evidenceReference: string;
    reason: string;
  }): Promise<
    | { ok: true; status: BronzeStatus; userId: string; attemptId: string }
    | { ok: false; reason: "closed" | "own" | "checks" | "changed" }
  > {
    return this.db.transaction(async (tx) => {
      const [review] = await tx
        .select()
        .from(bronzeReview)
        .where(eq(bronzeReview.id, input.id))
        .for("update");
      if (!review || review.status !== "open") return { ok: false, reason: "closed" };
      if (review.userId === input.reviewerId) return { ok: false, reason: "own" };
      const [attempt] = await tx
        .select()
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, review.attemptId));
      const [state] = await tx
        .select()
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, review.userId))
        .for("update");
      // Only the attempt still waiting on this review; a revoked or withdrawn one is closed.
      if (
        !attempt ||
        !state ||
        state.currentAttemptId !== review.attemptId ||
        state.status !== "manual_review"
      )
        return { ok: false, reason: "closed" };
      const approve = input.decision === "approve";
      const checks: BronzeChecks = {
        ...emptyBronzeChecks(),
        ...(attempt.checks as Partial<BronzeChecks>),
        ...(approve ? { profileFace: true, country: true } : {}),
      };
      if (approve) {
        if (!idChecksPass(checks) || !canAwardBronze(checks))
          return { ok: false, reason: "checks" };
        const [current] = await tx
          .select({
            avatarKey: profile.avatarKey,
            dob: profile.dateOfBirth,
            gender: profile.gender,
          })
          .from(profile)
          .where(eq(profile.userId, review.userId));
        if (
          current?.avatarKey !== attempt.avatarKey ||
          current.dob !== attempt.profileDob ||
          current.gender !== attempt.profileGender
        )
          return { ok: false, reason: "changed" };
      }
      const now = new Date();
      await tx
        .update(bronzeReview)
        .set({
          status: approve ? "approved" : "rejected",
          reviewerId: input.reviewerId,
          evidenceReference: input.evidenceReference,
          decisionReason: input.reason,
          decidedAt: now,
        })
        .where(eq(bronzeReview.id, input.id));
      await tx
        .update(bronzeAttempt)
        .set({
          checks: checks as unknown as Record<string, boolean>,
          status: approve ? "verified" : "failed",
          failureCodes: approve ? [] : ["MANUAL_REVIEW_REJECTED"],
          completedAt: now,
        })
        .where(eq(bronzeAttempt.id, attempt.id));
      const status: BronzeStatus = approve ? "verified" : afterFailure(state.attemptsUsed);
      await tx
        .update(bronzeVerification)
        .set(
          approve
            ? {
                status,
                attemptsUsed: 0,
                verifiedAt: now,
                verifiedAvatarKey: attempt.avatarKey,
                verifiedDob: attempt.profileDob,
                verifiedGender: attempt.profileGender,
              }
            : { status },
        )
        .where(eq(bronzeVerification.userId, review.userId));
      return { ok: true, status, userId: review.userId, attemptId: attempt.id };
    });
  }

  /** An admin takes a verification away; only they can allow a new try. */
  async revoke(userId: string) {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .update(bronzeVerification)
        .set({
          status: "revoked",
          currentAttemptId: null,
          verifiedAt: null,
          verifiedAvatarKey: null,
          verifiedDob: null,
          verifiedGender: null,
        })
        .where(eq(bronzeVerification.userId, userId))
        .returning({ userId: bronzeVerification.userId });
      if (!row) return false;
      // Nothing still in flight may bring the verification back.
      await tx
        .update(bronzeAttempt)
        .set({ status: "failed", failureCodes: ["VERIFICATION_REVOKED"], completedAt: now })
        .where(
          and(
            eq(bronzeAttempt.userId, userId),
            inArray(bronzeAttempt.status, ["started", "processing"]),
          ),
        );
      await tx
        .update(bronzeReview)
        .set({ status: "withdrawn", decidedAt: now })
        .where(and(eq(bronzeReview.userId, userId), eq(bronzeReview.status, "open")));
      return true;
    });
  }

  /** An admin gives a rejected or revoked member a fresh set of attempts. */
  async reopen(userId: string) {
    const [row] = await this.db
      .update(bronzeVerification)
      .set({ status: "not_started", attemptsUsed: 0, currentAttemptId: null })
      .where(
        and(
          eq(bronzeVerification.userId, userId),
          inArray(bronzeVerification.status, ["rejected", "revoked"]),
        ),
      )
      .returning({ userId: bronzeVerification.userId });
    return Boolean(row);
  }

  async recordCallback(input: {
    attemptId: string;
    userId: string;
    fingerprint: string;
    resultCode: string;
    checks: BronzeChecks;
    status: "processing" | "failed" | "manual_review" | "verified";
    failureCodes: string[];
    identityBinding: string | null;
  }) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, input.userId))
        .for("update");
      if (!current || current.currentAttemptId !== input.attemptId || current.status !== "pending")
        return null;
      const [recorded] = await tx
        .insert(bronzeCallback)
        .values({
          attemptId: input.attemptId,
          fingerprint: input.fingerprint,
          resultCode: input.resultCode,
        })
        .onConflictDoNothing()
        .returning({ id: bronzeCallback.id });
      if (!recorded) return null;
      const [attempt] = await tx
        .select()
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, input.attemptId));
      const old = attempt.checks as Partial<BronzeChecks>;
      const merged = { ...emptyBronzeChecks(), ...old };
      for (const key of Object.keys(merged) as (keyof BronzeChecks)[]) {
        merged[key] = Boolean(merged[key] || input.checks[key]);
      }
      const [currentProfile] = await tx
        .select()
        .from(profile)
        .where(eq(profile.userId, input.userId))
        .for("update");
      const { checks, status, failureCodes } = bronzeCallbackOutcome({
        ...input,
        checks: merged,
        attemptNumber: current.attemptsUsed,
        profileUnchanged:
          currentProfile?.avatarKey === attempt.avatarKey &&
          currentProfile?.dateOfBirth === attempt.profileDob &&
          currentProfile?.gender === attempt.profileGender &&
          currentProfile?.country === attempt.profileCountry,
      });
      const finished = status !== "processing";
      await tx
        .update(bronzeAttempt)
        .set({
          checks: checks as unknown as Record<string, boolean>,
          status: status === "rejected" ? "failed" : status,
          failureCodes,
          identityBinding: input.identityBinding,
          completedAt: finished ? new Date() : null,
        })
        .where(eq(bronzeAttempt.id, input.attemptId));
      if (finished) {
        await tx
          .update(bronzeVerification)
          .set(
            status === "verified"
              ? {
                  status,
                  attemptsUsed: 0,
                  verifiedAt: new Date(),
                  verifiedAvatarKey: attempt.avatarKey,
                  verifiedDob: attempt.profileDob,
                  verifiedGender: attempt.profileGender,
                }
              : { status },
          )
          .where(eq(bronzeVerification.userId, input.userId));
      }
      let reviewOpened = false;
      if (status === "manual_review") {
        const [opened] = await tx
          .insert(bronzeReview)
          .values({
            userId: input.userId,
            attemptId: input.attemptId,
            reasonCodes: failureCodes,
          })
          .onConflictDoNothing()
          .returning({ id: bronzeReview.id });
        reviewOpened = Boolean(opened);
      }
      return { status, checks, reviewOpened };
    });
  }
}
