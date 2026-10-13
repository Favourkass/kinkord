import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNotNull, isNull, max, ne, sql } from "drizzle-orm";
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
  verificationErasure,
  verificationIdentityHold,
  type BronzeStatus,
} from "../db/schema";
import {
  BRONZE_MAX_ATTEMPTS,
  BRONZE_POLICY_VERSION,
  bronzeCallbackOutcome,
  emptyBronzeChecks,
  reviewOutcome,
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

/** Serialises everything that decides whether one identity is on two accounts. */
const lockIdentity = (tx: Pick<Db, "execute">, binding: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"identity:" + binding}))`);

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
   * member's Didit sessions so the caller can also attempt immediate erasure.
   * Durable erasure work is queued in this same transaction, before any later
   * account deletion can cascade the member-owned rows away.
   *
   * It is not a way round the attempt limit: attempts already used stay used,
   * and a member out of attempts (or revoked) stays that way until an admin
   * reopens them. Otherwise withdrawing and consenting again would buy three
   * more paid Didit sessions, as often as anyone liked.
   */
  async withdrawConsent(userId: string): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      await tx.insert(bronzeVerification).values({ userId }).onConflictDoNothing();
      const [state] = await tx
        .select({
          status: bronzeVerification.status,
          attemptsUsed: bronzeVerification.attemptsUsed,
        })
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, userId))
        .for("update");
      const sessions = await this.diditSessions(tx, userId);
      if (sessions.length)
        await tx
          .insert(verificationErasure)
          .values(sessions.map((providerSessionId) => ({ providerSessionId })))
          .onConflictDoNothing({
            target: [verificationErasure.provider, verificationErasure.providerSessionId],
          });
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
      const status: BronzeStatus =
        state?.status === "revoked"
          ? "revoked"
          : state?.status === "rejected" || (state?.attemptsUsed ?? 0) >= BRONZE_MAX_ATTEMPTS
            ? "rejected"
            : "not_started";
      await tx
        .update(bronzeVerification)
        .set({
          status,
          currentAttemptId: null,
          verifiedAt: null,
          verifiedAvatarKey: null,
          verifiedDob: null,
          verifiedGender: null,
        })
        .where(eq(bronzeVerification.userId, userId));
      return sessions;
    });
  }

  /**
   * Queue provider erasure before deleting a member and their attempts. It
   * takes the verification lock and ends anything in flight first, so a start
   * that's still between reserving and attaching can't attach its paid session
   * after the list is taken (that start queues its own session for erasure),
   * and withdraws consent, so no new start can reserve before the account goes.
   */
  async queueErasuresForUser(userId: string): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      await tx.insert(bronzeVerification).values({ userId }).onConflictDoNothing();
      await tx
        .select({ userId: bronzeVerification.userId })
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, userId))
        .for("update");
      await tx
        .update(bronzeAttempt)
        .set({ status: "failed", failureCodes: ["ACCOUNT_DELETED"], completedAt: new Date() })
        .where(
          and(
            eq(bronzeAttempt.userId, userId),
            inArray(bronzeAttempt.status, ["started", "processing"]),
          ),
        );
      await tx
        .update(bronzeVerification)
        .set({ currentAttemptId: null })
        .where(eq(bronzeVerification.userId, userId));
      // With no standing consent, reserve() refuses any start that comes after.
      await tx
        .update(bronzeConsent)
        .set({ withdrawnAt: new Date() })
        .where(and(eq(bronzeConsent.userId, userId), isNull(bronzeConsent.withdrawnAt)));
      const sessions = await this.diditSessions(tx, userId);
      if (sessions.length)
        await tx
          .insert(verificationErasure)
          .values(sessions.map((providerSessionId) => ({ providerSessionId })))
          .onConflictDoNothing({
            target: [verificationErasure.provider, verificationErasure.providerSessionId],
          });
      return sessions;
    });
  }

  /**
   * Keeps the member's identity fingerprints apart from their account, so the
   * same ID can't be verified elsewhere without an admin looking. For a
   * revocation, and for an account deleted with a ban.
   */
  async holdIdentities(userId: string, db: Pick<Db, "select" | "insert"> = this.db) {
    const rows = await db
      .select({ binding: bronzeAttempt.identityBinding })
      .from(bronzeAttempt)
      .where(and(eq(bronzeAttempt.userId, userId), isNotNull(bronzeAttempt.identityBinding)));
    const bindings = [...new Set(rows.map((r) => r.binding).filter((b): b is string => !!b))];
    if (bindings.length)
      await db
        .insert(verificationIdentityHold)
        .values(bindings.map((binding) => ({ binding, userId })))
        .onConflictDoNothing();
  }

  /** Queue one newly-created provider session that could not be attached locally. */
  async queueErasure(providerSessionId: string) {
    await this.db
      .insert(verificationErasure)
      .values({ providerSessionId })
      .onConflictDoNothing({
        target: [verificationErasure.provider, verificationErasure.providerSessionId],
      });
  }

  /** Claim retryable provider erasures without two workers taking the same row. */
  async claimErasures(limit: number) {
    const due = this.db
      .select({ id: verificationErasure.id })
      .from(verificationErasure)
      .where(
        and(
          isNull(verificationErasure.completedAt),
          sql`${verificationErasure.nextAttemptAt} <= now()`,
          sql`(${verificationErasure.claimedAt} is null or ${verificationErasure.claimedAt} < now() - interval '5 minutes')`,
        ),
      )
      .orderBy(verificationErasure.nextAttemptAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    return this.db
      .update(verificationErasure)
      .set({ claimedAt: new Date() })
      .where(inArray(verificationErasure.id, due))
      .returning({
        id: verificationErasure.id,
        provider: verificationErasure.provider,
        providerSessionId: verificationErasure.providerSessionId,
        attempts: verificationErasure.attempts,
      });
  }

  async completeErasure(id: string) {
    await this.db
      .update(verificationErasure)
      .set({ completedAt: new Date(), claimedAt: null, lastError: null })
      .where(eq(verificationErasure.id, id));
  }

  async failErasure(id: string, error: string) {
    await this.db
      .update(verificationErasure)
      .set({
        attempts: sql`${verificationErasure.attempts} + 1`,
        claimedAt: null,
        lastError: error.slice(0, 1_000),
        nextAttemptAt: sql`now() + least(interval '24 hours', interval '1 minute' * power(2, least(${verificationErasure.attempts}, 10)))`,
      })
      .where(eq(verificationErasure.id, id));
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

  /**
   * Reserve locally before opening a paid provider session. The verification
   * row lock makes a double tap return one reservation and one null.
   */
  async reserve(userId: string, snapshot: ProfileSnapshot) {
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
      // Withdrawing takes this same lock, so a consent seen here still stands.
      const [consented] = await tx
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
      if (!consented) return null;
      const [last] = await tx
        .select({ number: max(bronzeAttempt.number) })
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.userId, userId));
      const id = randomUUID();
      const reservationJobId = `reservation:${id}`;
      await tx.insert(bronzeAttempt).values({
        id,
        userId,
        number: (last?.number ?? 0) + 1,
        providerJobId: reservationJobId,
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
      return { attemptId: id, reservationJobId };
    });
  }

  /** Attach the paid provider session only to the reservation that still owns the row. */
  async attachProviderSession(attemptId: string, providerSessionId: string) {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({ userId: bronzeAttempt.userId })
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, attemptId));
      if (!candidate) return false;
      const [state] = await tx
        .select()
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, candidate.userId))
        .for("update");
      const [attempt] = await tx
        .select()
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, attemptId))
        .for("update");
      if (
        !state ||
        !attempt ||
        state.currentAttemptId !== attemptId ||
        state.status !== "pending" ||
        !attempt.providerJobId.startsWith("reservation:")
      )
        return false;
      const [updated] = await tx
        .update(bronzeAttempt)
        .set({ providerJobId: `didit:${providerSessionId}` })
        .where(eq(bronzeAttempt.id, attemptId))
        .returning({ id: bronzeAttempt.id });
      return Boolean(updated);
    });
  }

  /**
   * Release a reservation when no provider session was successfully attached.
   * The attempt is given back. A reservation the member has since moved past
   * (a withdrawal, say) is simply removed.
   */
  async cancelReservation(attemptId: string) {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({ userId: bronzeAttempt.userId })
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, attemptId));
      if (!candidate) return false;
      const [state] = await tx
        .select()
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, candidate.userId))
        .for("update");
      const [attempt] = await tx
        .select()
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, attemptId))
        .for("update");
      if (!attempt || !attempt.providerJobId.startsWith("reservation:")) return false;
      await tx.delete(bronzeAttempt).where(eq(bronzeAttempt.id, attemptId));
      if (!state || state.currentAttemptId !== attemptId) return false;
      const attemptsUsed = Math.max(0, state.attemptsUsed - 1);
      await tx
        .update(bronzeVerification)
        .set({
          status: attemptsUsed === 0 ? "not_started" : "failed",
          attemptsUsed,
          currentAttemptId: null,
        })
        .where(eq(bronzeVerification.userId, candidate.userId));
      return true;
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

  /**
   * Reservations that never got a Didit session: the start crashed or failed
   * between reserving and attaching. Starts take seconds, so anything this old
   * is abandoned and safe to release.
   */
  async staleReservations(limit: number) {
    return this.db
      .select({ id: bronzeAttempt.id })
      .from(bronzeAttempt)
      .where(
        and(
          sql`${bronzeAttempt.providerJobId} like 'reservation:%'`,
          sql`${bronzeAttempt.createdAt} < now() - interval '15 minutes'`,
        ),
      )
      .orderBy(bronzeAttempt.createdAt)
      .limit(limit);
  }

  /**
   * A session that ended without a result. When Didit never finished it
   * (`SESSION_EXPIRED`) the attempt counts toward the cap. When it's our side
   * that couldn't get the result (`RESULT_UNAVAILABLE`: an outage, or a
   * re-created workflow) the member gets the attempt back.
   */
  async expireAttempt(
    attemptId: string,
    reason: "SESSION_EXPIRED" | "RESULT_UNAVAILABLE" = "SESSION_EXPIRED",
  ) {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({ userId: bronzeAttempt.userId })
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, attemptId));
      if (!candidate) return false;
      const [state] = await tx
        .select()
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, candidate.userId))
        .for("update");
      const [attempt] = await tx
        .select()
        .from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, attemptId))
        .for("update");
      if (!attempt || !["started", "processing"].includes(attempt.status)) return false;
      await tx
        .update(bronzeAttempt)
        .set({ status: "failed", failureCodes: [reason], completedAt: new Date() })
        .where(eq(bronzeAttempt.id, attemptId));
      if (state?.currentAttemptId === attemptId && state.status === "pending") {
        const attemptsUsed =
          reason === "RESULT_UNAVAILABLE"
            ? Math.max(0, state.attemptsUsed - 1)
            : state.attemptsUsed;
        await tx
          .update(bronzeVerification)
          .set(
            reason === "RESULT_UNAVAILABLE"
              ? { status: attemptsUsed === 0 ? "not_started" : "failed", attemptsUsed }
              : { status: afterFailure(attemptsUsed) },
          )
          .where(eq(bronzeVerification.userId, candidate.userId));
      }
      return true;
    });
  }

  /**
   * Whether the same person's ID is verified on, being reviewed for, or held
   * against another account. Callers that act on the answer take the
   * identity's lock first and pass their transaction, so two accounts
   * finishing at once can't both see "no".
   */
  async bindingUsedElsewhere(
    binding: string,
    userId: string,
    db: Pick<Db, "select"> = this.db,
  ): Promise<boolean> {
    const [attempt] = await db
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
    if (attempt) return true;
    const [hold] = await db
      .select({ binding: verificationIdentityHold.binding })
      .from(verificationIdentityHold)
      .where(
        and(
          eq(verificationIdentityHold.binding, binding),
          ne(verificationIdentityHold.userId, userId),
        ),
      )
      .limit(1);
    return Boolean(hold);
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
   * An admin's decision on a review (the rules are `reviewOutcome`'s). Takes
   * the member's verification lock, then the identity's, and checks the review
   * is still the one their verification waits on.
   */
  async decideReview(input: {
    id: string;
    reviewerId: string;
    decision: "approve" | "reject";
    evidenceReference: string;
    reason: string;
  }): Promise<
    | { ok: true; status: BronzeStatus; userId: string; attemptId: string }
    | { ok: false; reason: "closed" | "own" | "checks" | "changed" | "duplicate" }
  > {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({ userId: bronzeReview.userId })
        .from(bronzeReview)
        .where(eq(bronzeReview.id, input.id));
      if (!candidate) return { ok: false, reason: "closed" };
      if (candidate.userId === input.reviewerId) return { ok: false, reason: "own" };
      const [state] = await tx
        .select()
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, candidate.userId))
        .for("update");
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
      // Only the attempt still waiting on this review; a revoked or withdrawn one is closed.
      if (
        !attempt ||
        !state ||
        state.currentAttemptId !== review.attemptId ||
        state.status !== "manual_review"
      )
        return { ok: false, reason: "closed" };
      const approve = input.decision === "approve";
      const reasonCodes = (review.reasonCodes as string[]) ?? [];
      let profileUnchanged = true;
      let sameIdentityElsewhere = false;
      if (approve) {
        const [current] = await tx
          .select({
            avatarKey: profile.avatarKey,
            dob: profile.dateOfBirth,
            gender: profile.gender,
          })
          .from(profile)
          .where(eq(profile.userId, review.userId));
        profileUnchanged =
          current?.avatarKey === attempt.avatarKey &&
          current.dob === attempt.profileDob &&
          current.gender === attempt.profileGender;
        // Checked now, under the identity's lock: the other account may have
        // withdrawn since the review opened, or appeared since.
        if (profileUnchanged && attempt.identityBinding) {
          await lockIdentity(tx, attempt.identityBinding);
          sameIdentityElsewhere = await this.bindingUsedElsewhere(
            attempt.identityBinding,
            review.userId,
            tx,
          );
        }
      }
      const outcome = reviewOutcome({
        decision: input.decision,
        checks: attempt.checks as Partial<BronzeChecks>,
        attemptsUsed: state.attemptsUsed,
        profileUnchanged,
        sameIdentityElsewhere,
      });
      const now = new Date();
      if (!outcome.ok) {
        if (outcome.reason === "duplicate" && !reasonCodes.includes("IDENTITY_ON_ANOTHER_ACCOUNT"))
          await tx
            .update(bronzeReview)
            .set({ reasonCodes: [...reasonCodes, "IDENTITY_ON_ANOTHER_ACCOUNT"] })
            .where(eq(bronzeReview.id, input.id));
        if (outcome.reason === "changed") {
          await tx
            .update(bronzeReview)
            .set({ status: "withdrawn", reviewerId: input.reviewerId, decidedAt: now })
            .where(eq(bronzeReview.id, input.id));
          await tx
            .update(bronzeAttempt)
            .set({ status: "failed", failureCodes: outcome.failureCodes, completedAt: now })
            .where(eq(bronzeAttempt.id, attempt.id));
          await tx
            .update(bronzeVerification)
            .set({ status: outcome.status })
            .where(eq(bronzeVerification.userId, review.userId));
        }
        return { ok: false, reason: outcome.reason };
      }
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
          checks: outcome.checks as unknown as Record<string, boolean>,
          status: outcome.attemptStatus,
          failureCodes: outcome.failureCodes,
          completedAt: now,
        })
        .where(eq(bronzeAttempt.id, attempt.id));
      await tx
        .update(bronzeVerification)
        .set(
          outcome.status === "verified"
            ? {
                status: outcome.status,
                attemptsUsed: 0,
                verifiedAt: now,
                verifiedAvatarKey: attempt.avatarKey,
                verifiedDob: attempt.profileDob,
                verifiedGender: attempt.profileGender,
              }
            : { status: outcome.status },
        )
        .where(eq(bronzeVerification.userId, review.userId));
      return { ok: true, status: outcome.status, userId: review.userId, attemptId: attempt.id };
    });
  }

  /** An admin takes a verification away; only they can allow a new try. */
  async revoke(userId: string) {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [state] = await tx
        .select({ userId: bronzeVerification.userId })
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, userId))
        .for("update");
      if (!state) return false;
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
      // The same ID can't simply be verified on a fresh account instead.
      await this.holdIdentities(userId, tx);
      return true;
    });
  }

  /** An admin gives a rejected or revoked member a fresh set of attempts. */
  async reopen(userId: string) {
    return this.db.transaction(async (tx) => {
      const [state] = await tx
        .select({ status: bronzeVerification.status })
        .from(bronzeVerification)
        .where(eq(bronzeVerification.userId, userId))
        .for("update");
      if (!state || !["rejected", "revoked"].includes(state.status)) return false;
      const [row] = await tx
        .update(bronzeVerification)
        .set({ status: "not_started", attemptsUsed: 0, currentAttemptId: null })
        .where(eq(bronzeVerification.userId, userId))
        .returning({ userId: bronzeVerification.userId });
      return Boolean(row);
    });
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
      // Checked here, under the identity's lock, so two accounts of one person
      // finishing at the same moment can't both pass.
      const passing = input.status === "verified" || input.status === "manual_review";
      let duplicate = false;
      if (passing && input.identityBinding) {
        await lockIdentity(tx, input.identityBinding);
        duplicate = await this.bindingUsedElsewhere(input.identityBinding, input.userId, tx);
      }
      const { checks, status, failureCodes } = bronzeCallbackOutcome({
        ...input,
        checks: merged,
        duplicate,
        bindingMissing: passing && !input.identityBinding,
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
