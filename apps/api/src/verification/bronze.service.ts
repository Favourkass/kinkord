import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PushService } from "../push/push.service";
import { StorageService } from "../storage/storage.service";
import { BronzeRepository } from "./bronze.repository";
import {
  BRONZE_MAX_ATTEMPTS,
  BRONZE_POLICY_VERSION,
  canAwardBronze,
  emptyBronzeChecks,
  idChecksPass,
  interpretDiditResult,
  matchIdentity,
  stillVerified,
  type BronzeChecks,
} from "./bronze-policy";
import { DiditService } from "./didit.service";
import { identityBinding } from "./identity-binding";
import { ProfileMatchService } from "./profile-match.service";
import { VerificationConfig } from "./verification-config";

/** A photo must be older than its upload links (10 minutes), so nobody can swap it mid-check. */
export const PHOTO_SETTLE_MS = 10 * 60_000;
/** A verified photo can't be older than this; members re-verify with a recent one. */
export const PHOTO_MAX_AGE_MS = 90 * 24 * 60 * 60_000;
/** Sessions Didit hasn't finished in this long are expired (unless Didit is reviewing them). */
export const SESSION_EXPIRY_MS = 24 * 60 * 60_000;
const RECONCILE_EVERY_MS = 5 * 60_000;
/** How often a member's own status check may ask Didit about a pending session. */
const REFRESH_EVERY_MS = 60_000;

export interface Admin {
  id: string;
  twoFactorEnabled?: boolean | null;
}

/** Sanitised for logs: the error's kind, never a message that might carry details. */
const kind = (e: unknown) => (e instanceof Error ? e.name : "error");

/**
 * Identity verification ("Bronze"): a government ID, a live selfie, and a match
 * between that selfie and the member's profile photo, through Didit. What
 * Didit can't settle on its own, an admin decides from Moderation.
 */
@Injectable()
export class BronzeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BronzeService.name);
  private readonly refreshed = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly repo: BronzeRepository,
    private readonly didit: DiditService,
    private readonly storage: StorageService,
    private readonly profileMatch: ProfileMatchService,
    private readonly push: PushService,
    private readonly config: VerificationConfig,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.reconcile(), RECONCILE_EVERY_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async status(userId: string, now = Date.now()) {
    let state = await this.repo.state(userId);
    if (state?.status === "pending" && state.currentAttemptId && this.didit.configured) {
      // A member checking back may beat the webhook; ask Didit, at most once a minute.
      const last = this.refreshed.get(state.currentAttemptId) ?? 0;
      if (now - last > REFRESH_EVERY_MS) {
        this.refreshed.set(state.currentAttemptId, now);
        if (this.refreshed.size > 10_000) this.refreshed.clear();
        const attempt = await this.repo.attempt(state.currentAttemptId);
        if (attempt?.providerJobId.startsWith("didit:")) {
          try {
            await this.recordDiditDecision(attempt.providerJobId.slice(6));
            state = await this.repo.state(userId);
          } catch (e) {
            this.logger.warn(`Didit status refresh deferred (${kind(e)})`);
          }
        }
      }
    }
    const [snapshot, consented] = await Promise.all([
      this.repo.snapshot(userId),
      this.repo.hasConsent(userId),
    ]);
    const uploadedAt = snapshot?.avatarUploadedAt?.getTime() ?? 0;
    const missing = [
      (!snapshot?.avatarKey || uploadedAt < now - PHOTO_MAX_AGE_MS) && "profilePhoto",
      !snapshot?.dob && "dateOfBirth",
      !snapshot?.gender && "gender",
      !snapshot?.country && "country",
    ].filter((value): value is string => typeof value === "string");
    // Verified, but the photo, birth date or gender has changed since: verify again.
    const outdated =
      state?.status === "verified" &&
      !stillVerified(state, {
        avatarKey: snapshot?.avatarKey ?? null,
        dateOfBirth: snapshot?.dob ?? null,
        gender: snapshot?.gender ?? null,
      });
    const attemptsUsed = state?.attemptsUsed ?? 0;
    return {
      available: this.didit.configured,
      status: outdated ? ("outdated" as const) : (state?.status ?? ("not_started" as const)),
      attemptsUsed,
      attemptsRemaining: Math.max(0, BRONZE_MAX_ATTEMPTS - attemptsUsed),
      consented,
      policyVersion: BRONZE_POLICY_VERSION,
      policyUrl: this.didit.policyUrl || null,
      missing,
      photoReadyAt:
        uploadedAt && uploadedAt + PHOTO_SETTLE_MS > now
          ? new Date(uploadedAt + PHOTO_SETTLE_MS).toISOString()
          : null,
    };
  }

  async consent(userId: string, accepted: boolean, version: string) {
    if (accepted !== true || version !== BRONZE_POLICY_VERSION) {
      throw new BadRequestException("The current verification consent is required.");
    }
    if (!this.didit.configured) {
      throw new ServiceUnavailableException("Verification isn't available yet.");
    }
    await this.repo.consent(userId);
    return this.status(userId);
  }

  /** Withdrawing ends the check and the badge, and erases the member's sessions at Didit. */
  async withdraw(userId: string) {
    const sessions = await this.repo.withdrawConsent(userId);
    await this.eraseAtDidit(sessions);
    return this.status(userId);
  }

  /** Before an account is deleted: erase what Didit holds about the member. */
  async forgetMember(userId: string) {
    await this.eraseAtDidit(await this.repo.diditSessionsOf(userId));
  }

  private async eraseAtDidit(sessions: string[]) {
    const results = await Promise.allSettled(sessions.map((id) => this.didit.deleteSession(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) this.logger.warn(`${failed} Didit session(s) couldn't be erased; retry by hand`);
  }

  async start(userId: string) {
    const status = await this.status(userId);
    if (!status.available)
      throw new ServiceUnavailableException("Verification isn't available yet.");
    if (status.missing.length)
      throw new BadRequestException({
        message: "Complete your profile and add a recent photo first.",
        missing: status.missing,
      });
    if (status.photoReadyAt)
      throw new BadRequestException({
        message: "Your photo was just uploaded. You can verify it in a few minutes.",
        photoReadyAt: status.photoReadyAt,
      });
    if (!status.consented)
      throw new BadRequestException("Consent is required before verification.");
    if (status.status === "pending")
      throw new ConflictException("Verification is already in progress.");
    if (status.status === "verified") throw new ConflictException("You're already verified.");
    if (status.status === "manual_review")
      throw new ConflictException("Your verification is with our team.");
    if (status.status === "rejected" || status.status === "revoked" || !status.attemptsRemaining)
      throw new ForbiddenException("Contact support to verify again.");
    const snapshot = await this.repo.snapshot(userId);
    if (!snapshot?.avatarKey || !snapshot.dob || !snapshot.gender || !snapshot.country)
      throw new BadRequestException("Complete your profile first.");
    try {
      // Every size of the photo comes from the one that gets checked.
      await this.storage.regenerateVariants(snapshot.avatarKey);
    } catch (e) {
      this.logger.warn(`Photo preparation failed (${kind(e)})`);
      throw new ServiceUnavailableException("Couldn't prepare your photo. Please try again.");
    }
    // Opened before the attempt is reserved, so a Didit outage never uses one up.
    const session = await this.didit.createSession(userId);
    const attemptId = await this.repo.reserve(
      userId,
      {
        avatarKey: snapshot.avatarKey,
        dob: snapshot.dob,
        gender: snapshot.gender,
        country: snapshot.country,
        nationality: snapshot.nationality,
      },
      `didit:${session.sessionId}`,
    );
    if (!attemptId)
      throw new ConflictException("Verification state changed. Refresh and try again.");
    return { attemptId, provider: "didit" as const, url: session.url };
  }

  diditCallback(
    body: unknown,
    signatureV2: string | undefined,
    signatureRaw: string | undefined,
    timestamp: string | undefined,
  ) {
    const raw = this.didit.verifyWebhook(body, signatureV2, signatureRaw, timestamp);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("Invalid Didit callback");
    }
    if (typeof payload.session_id !== "string")
      throw new BadRequestException("Missing Didit session");
    // Didit counts replies slower than five seconds as failed, so answer now and
    // process after. Anything that fails here is picked up by reconcile().
    void this.recordDiditDecision(payload.session_id).catch((e) =>
      this.logger.warn(`Didit callback processing deferred (${kind(e)})`),
    );
    return { received: true };
  }

  /** Background safety net: settles attempts whose webhook was missed or failed. */
  async reconcile(now = Date.now()) {
    if (!this.didit.configured) return;
    let due: Awaited<ReturnType<BronzeRepository["claimForReconcile"]>>;
    try {
      due = await this.repo.claimForReconcile(20);
    } catch (e) {
      this.logger.warn(`Verification reconcile skipped (${kind(e)})`);
      return;
    }
    for (const attempt of due) {
      try {
        const outcome = await this.recordDiditDecision(attempt.providerJobId.slice(6));
        if (
          !outcome.terminal &&
          !outcome.inProviderReview &&
          attempt.createdAt.getTime() < now - SESSION_EXPIRY_MS
        )
          await this.repo.expireAttempt(attempt.id);
      } catch (e) {
        this.logger.warn(`Verification reconcile failed for one attempt (${kind(e)})`);
      }
    }
  }

  private async recordDiditDecision(
    sessionId: string,
  ): Promise<{ terminal: boolean; inProviderReview: boolean }> {
    const attempt = await this.repo.findAttempt(`didit:${sessionId}`);
    if (!attempt) throw new NotFoundException("Unknown Didit session");
    if (attempt.status !== "started" && attempt.status !== "processing")
      return { terminal: true, inProviderReview: false };
    const decision = await this.didit.decision(sessionId);
    if (
      decision.session_id !== sessionId ||
      decision.session_kind !== "user" ||
      decision.vendor_data !== attempt.userId ||
      decision.workflow_id !== this.didit.workflowId
    ) {
      throw new BadRequestException("Mismatched Didit decision");
    }
    const result = interpretDiditResult(decision, attempt.profileCountry);
    if (!result.terminal) return { terminal: false, inProviderReview: result.inProviderReview };
    const identity = matchIdentity(result.identity, {
      dob: attempt.profileDob,
      gender: attempt.profileGender,
      country: attempt.profileCountry,
      nationality: attempt.profileNationality,
    });
    const checks: BronzeChecks = {
      ...emptyBronzeChecks(),
      governmentId: result.governmentId,
      liveness: result.liveness,
      idFace: result.idFace,
      ...identity,
    };
    const idPassed = idChecksPass(checks);
    const failureCodes: string[] = result.failed
      ? ["DIDIT_DECLINED"]
      : idPassed
        ? []
        : ["DIDIT_REQUIRED_CHECK_MISSING"];
    let status: "failed" | "manual_review" | "verified" = "failed";
    let binding: string | null = null;
    if (!result.failed && idPassed) {
      const match = await this.profileMatch.evaluate(attempt, decision);
      if (!match) return { terminal: false, inProviderReview: false };
      checks.profileFace = match.outcome === "matched";
      if (!checks.profileFace)
        failureCodes.push(match.reason ?? "PROFILE_PHOTO_MATCH_INCONCLUSIVE");
      if (!checks.country) failureCodes.push("ID_COUNTRY_UNCONFIRMED");
      status = canAwardBronze(checks) ? "verified" : "manual_review";
      binding = this.bindingFor(result.identity);
      if (binding && (await this.repo.bindingUsedElsewhere(binding, attempt.userId))) {
        status = "manual_review";
        failureCodes.push("IDENTITY_ON_ANOTHER_ACCOUNT");
      }
    }
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ sessionId, status: decision.status, checks }))
      .digest("hex");
    const recorded = await this.repo.recordCallback({
      attemptId: attempt.id,
      userId: attempt.userId,
      fingerprint,
      resultCode: String(decision.status),
      checks,
      status,
      failureCodes,
      identityBinding: binding,
    });
    if (recorded?.reviewOpened) this.push.newVerificationReview();
    return { terminal: true, inProviderReview: false };
  }

  private bindingFor(identity: { FullName: string; DOB: string; Gender: string }) {
    try {
      return identityBinding(
        { fullName: identity.FullName, dateOfBirth: identity.DOB, gender: identity.Gender },
        this.config.current.bindingSecret,
      );
    } catch {
      return null;
    }
  }

  // ---- Admins (routes are behind AdminGuard; decisions also need 2FA) ----

  private requireTwoFactor(admin: Admin) {
    if (!admin.twoFactorEnabled)
      throw new ForbiddenException(
        "Turn on two-factor authentication (Settings, Security & 2FA) to review verifications.",
      );
  }

  async reviews(admin: Admin) {
    this.requireTwoFactor(admin);
    const rows = await this.repo.openReviews();
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        reasonCodes: row.reasonCodes,
        createdAt: row.createdAt,
        providerSessionId: row.providerJobId.replace(/^didit:/, ""),
        checks: row.checks,
        // The photo as members see it, and the original it was made from.
        photoUrl: await this.storage.presignReviewDownload(row.avatarKey, "md"),
        originalPhotoUrl: await this.storage.presignReviewDownload(row.avatarKey),
      })),
    );
  }

  async decideReview(
    admin: Admin,
    input: {
      id: string;
      decision: "approve" | "reject";
      evidenceReference: string;
      reason: string;
    },
  ) {
    this.requireTwoFactor(admin);
    const result = await this.repo.decideReview({ ...input, reviewerId: admin.id });
    if (!result.ok) {
      if (result.reason === "own")
        throw new ForbiddenException("You can't decide your own verification.");
      if (result.reason === "checks")
        throw new ConflictException(
          "This attempt didn't pass the ID checks, so it can't be approved.",
        );
      if (result.reason === "changed")
        throw new ConflictException(
          "The member changed their photo, birth date or gender since, so they need to verify again.",
        );
      throw new ConflictException("This review is already closed.");
    }
    this.logger.log(`Verification review decided (${input.decision}) by an admin`);
    return { status: result.status };
  }

  async revoke(admin: Admin, userId: string) {
    this.requireTwoFactor(admin);
    if (!(await this.repo.revoke(userId))) throw new NotFoundException("Nothing to revoke.");
    return { status: "revoked" as const };
  }

  async reopen(admin: Admin, userId: string) {
    this.requireTwoFactor(admin);
    if (!(await this.repo.reopen(userId)))
      throw new ConflictException("Only a rejected or revoked verification can be reopened.");
    return { status: "not_started" as const };
  }

  /** What Moderation shows on a member's page. */
  async adminStatus(userId: string) {
    const state = await this.repo.state(userId);
    return { status: state?.status ?? "not_started", attemptsUsed: state?.attemptsUsed ?? 0 };
  }
}
