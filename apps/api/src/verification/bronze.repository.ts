import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import { bronzeAttempt, bronzeCallback, bronzeConsent, bronzeReview, bronzeVerification, profile, profileMedia } from "../db/schema";
import { BRONZE_MAX_ATTEMPTS, BRONZE_POLICY_VERSION, canAwardBronze, emptyBronzeChecks, type BronzeChecks } from "./bronze-policy";

@Injectable()
export class BronzeRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async snapshot(userId: string) {
    const [identity] = await this.db.select({
      avatarKey: profile.avatarKey, dob: profile.dateOfBirth,
      gender: profile.gender, country: profile.country,
    }).from(profile).where(eq(profile.userId, userId));
    if (!identity) return null;
    const [photo] = identity.avatarKey ? await this.db.select({ uploadedAt: profileMedia.createdAt })
      .from(profileMedia).where(and(eq(profileMedia.userId, userId), eq(profileMedia.kind, "avatar"), eq(profileMedia.key, identity.avatarKey)))
      .orderBy(desc(profileMedia.createdAt)).limit(1) : [];
    return { ...identity, avatarUploadedAt: photo?.uploadedAt ?? null };
  }

  async status(userId: string) {
    await this.expirePending(userId);
    const [row] = await this.db.select().from(bronzeVerification).where(eq(bronzeVerification.userId, userId));
    return row ?? null;
  }

  /** Abandoned camera sessions cannot lock an account indefinitely. */
  private async expirePending(userId: string) {
    await this.db.transaction(async (tx) => {
      const [state] = await tx.select().from(bronzeVerification)
        .where(eq(bronzeVerification.userId, userId)).for("update");
      if (state?.status !== "pending" || !state.currentAttemptId) return;
      const [attempt] = await tx.select().from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, state.currentAttemptId));
      if (!attempt || attempt.createdAt.getTime() > Date.now() - 24 * 60 * 60 * 1000) return;
      const status = state.attemptsUsed >= BRONZE_MAX_ATTEMPTS ? "manual_review" : "failed";
      await tx.update(bronzeAttempt).set({ status, failureCodes: ["SESSION_EXPIRED"], completedAt: new Date() })
        .where(eq(bronzeAttempt.id, attempt.id));
      await tx.update(bronzeVerification).set({ status })
        .where(eq(bronzeVerification.userId, userId));
      if (status === "manual_review") await tx.insert(bronzeReview)
        .values({ userId, attemptId: attempt.id, reasonCodes: ["SESSION_EXPIRED"] }).onConflictDoNothing();
    });
  }

  async consent(userId: string) {
    await this.db.insert(bronzeConsent).values({ userId, policyVersion: BRONZE_POLICY_VERSION });
  }

  async hasConsent(userId: string) {
    const [row] = await this.db.select({ id: bronzeConsent.id }).from(bronzeConsent)
      .where(and(eq(bronzeConsent.userId, userId), eq(bronzeConsent.policyVersion, BRONZE_POLICY_VERSION)))
      .orderBy(desc(bronzeConsent.acceptedAt)).limit(1);
    return Boolean(row);
  }

  /** The row lock serializes simultaneous requests and makes the three-attempt cap atomic. */
  async reserve(userId: string, snapshot: { avatarKey: string; dob: string; gender: string; country: string }, jobId: string) {
    return this.db.transaction(async (tx) => {
      await tx.insert(bronzeVerification).values({ userId }).onConflictDoNothing();
      const [state] = await tx.select().from(bronzeVerification)
        .where(eq(bronzeVerification.userId, userId)).for("update");
      if (state.status === "verified" || state.status === "manual_review" || state.attemptsUsed >= BRONZE_MAX_ATTEMPTS || state.status === "pending") {
        return null;
      }
      const id = randomUUID();
      await tx.insert(bronzeAttempt).values({
        id, userId, number: state.attemptsUsed + 1, providerJobId: jobId,
        avatarKey: snapshot.avatarKey, profileDob: snapshot.dob,
        profileGender: snapshot.gender, profileCountry: snapshot.country,
      });
      await tx.update(bronzeVerification).set({
        status: "pending", attemptsUsed: state.attemptsUsed + 1, currentAttemptId: id,
      }).where(eq(bronzeVerification.userId, userId));
      return id;
    });
  }

  async findAttempt(jobId: string) {
    const [row] = await this.db.select().from(bronzeAttempt).where(eq(bronzeAttempt.providerJobId, jobId));
    return row ?? null;
  }

  async attempt(id: string) {
    const [row] = await this.db.select().from(bronzeAttempt).where(eq(bronzeAttempt.id, id));
    return row ?? null;
  }

  async openReviews() {
    return this.db.select({
      id: bronzeReview.id, userId: bronzeReview.userId, attemptId: bronzeReview.attemptId,
      reasonCodes: bronzeReview.reasonCodes, createdAt: bronzeReview.createdAt,
      providerJobId: bronzeAttempt.providerJobId, avatarKey: bronzeAttempt.avatarKey,
      checks: bronzeAttempt.checks,
    }).from(bronzeReview).innerJoin(bronzeAttempt, eq(bronzeAttempt.id, bronzeReview.attemptId))
      .where(eq(bronzeReview.status, "open")).orderBy(bronzeReview.createdAt).limit(50);
  }

  async decideReview(input: { id: string; reviewerId: string; decision: "approve" | "reject";
    profileFaceMatches: boolean; evidenceReference: string; reason: string }) {
    return this.db.transaction(async (tx) => {
      const [review] = await tx.select().from(bronzeReview).where(eq(bronzeReview.id, input.id)).for("update");
      if (!review || review.status !== "open") return null;
      const [attempt] = await tx.select().from(bronzeAttempt).where(eq(bronzeAttempt.id, review.attemptId));
      const [state] = await tx.select().from(bronzeVerification).where(eq(bronzeVerification.userId, review.userId)).for("update");
      const [currentProfile] = await tx.select({ avatarKey: profile.avatarKey }).from(profile).where(eq(profile.userId, review.userId));
      if (!attempt || !state || state.currentAttemptId !== review.attemptId) return null;
      const checks = { ...emptyBronzeChecks(), ...(attempt.checks as Partial<BronzeChecks>), profileFace: input.profileFaceMatches };
      if (input.decision === "approve" && (!canAwardBronze(checks) || currentProfile?.avatarKey !== attempt.avatarKey)) return null;
      await tx.update(bronzeReview).set({
        status: input.decision === "approve" ? "approved" : "rejected",
        reviewerId: input.reviewerId, evidenceReference: input.evidenceReference,
        decisionReason: input.reason, decidedAt: new Date(),
      }).where(eq(bronzeReview.id, input.id));
      await tx.update(bronzeAttempt).set({
        checks: checks as unknown as Record<string, boolean>,
        status: input.decision === "approve" ? "verified" : "manual_review",
      }).where(eq(bronzeAttempt.id, attempt.id));
      if (input.decision === "approve") await tx.update(bronzeVerification).set({
        status: "verified", verifiedAt: new Date(), verifiedAvatarKey: attempt.avatarKey,
      }).where(eq(bronzeVerification.userId, review.userId));
      return { status: input.decision === "approve" ? "verified" : "manual_review" };
    });
  }

  async recordCallback(input: {
    attemptId: string; userId: string; fingerprint: string; resultCode: string;
    checks: BronzeChecks; status: "processing" | "failed" | "manual_review" | "verified";
    failureCodes: string[];
  }) {
    await this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(bronzeVerification)
        .where(eq(bronzeVerification.userId, input.userId)).for("update");
      if (!current || current.currentAttemptId !== input.attemptId || current.status !== "pending") return;
      const [recorded] = await tx.insert(bronzeCallback).values({
        attemptId: input.attemptId, fingerprint: input.fingerprint, resultCode: input.resultCode,
      }).onConflictDoNothing().returning({ id: bronzeCallback.id });
      if (!recorded) return;
      const [attempt] = await tx.select().from(bronzeAttempt)
        .where(eq(bronzeAttempt.id, input.attemptId));
      const old = attempt.checks as Partial<BronzeChecks>;
      const checks = { ...emptyBronzeChecks(), ...old };
      for (const key of Object.keys(checks) as (keyof BronzeChecks)[]) {
        checks[key] = Boolean(checks[key] || input.checks[key]);
      }
      const primaryPassed = checks.governmentId && checks.liveness && checks.idFace &&
        checks.dateOfBirth && checks.gender && checks.country;
      const failed = input.status === "failed" || (input.status === "manual_review" && input.failureCodes.some((code) => code !== "PROFILE_PHOTO_FACE_MATCH_REQUIRED"));
      const status = failed
        ? attempt.number >= BRONZE_MAX_ATTEMPTS ? "manual_review" : "failed"
        : canAwardBronze(checks) ? "verified"
        : primaryPassed ? "manual_review" : "processing";
      const failureCodes = status === "manual_review" && primaryPassed
        ? ["PROFILE_PHOTO_FACE_MATCH_REQUIRED"] : input.failureCodes;
      await tx.update(bronzeAttempt).set({
        checks: checks as unknown as Record<string, boolean>, status, failureCodes,
        completedAt: status === "processing" ? null : new Date(),
      }).where(eq(bronzeAttempt.id, input.attemptId));
      if (status !== "processing") {
        await tx.update(bronzeVerification).set({
          status,
          verifiedAt: status === "verified" ? new Date() : null,
          verifiedAvatarKey: status === "verified" ? attempt.avatarKey : null,
        }).where(eq(bronzeVerification.userId, input.userId));
        if (status === "manual_review") {
          await tx.insert(bronzeReview).values({
            userId: input.userId, attemptId: input.attemptId, reasonCodes: failureCodes,
          }).onConflictDoNothing();
        }
      }
    });
  }
}
