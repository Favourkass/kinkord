import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PushService } from "../push/push.service";
import { StorageService } from "../storage/storage.service";
import { AUTH, type Auth } from "../auth/auth.instance";
import { BronzeRepository } from "./bronze.repository";
import {
  BRONZE_MAX_ATTEMPTS,
  BRONZE_POLICY_VERSION,
  canAwardBronze,
  emptyBronzeChecks,
  idChecksPass,
  interpretDiditResult,
  matchIdentity,
  memberFailureReason,
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
/**
 * Failed reads of Didit's result in a row (about an hour of background
 * checks) before an old attempt is given up on. One timeout must never end it.
 */
export const RESULT_FAILURES_TO_GIVE_UP = 12;
const RECONCILE_EVERY_MS = 5 * 60_000;
/** How often a member's own status check may ask Didit about a pending session. */
const REFRESH_EVERY_MS = 60_000;
export const ADMIN_STEP_UP_MS = 10 * 60_000;
/** Wrong two-factor codes allowed in the window before the admin is locked out for it. */
export const STEP_UP_MAX_FAILURES = 5;
export const STEP_UP_WINDOW_MINUTES = 15;
/** Didit statuses a member can still pick up where they left off. */
const RESUMABLE = ["Not Started", "In Progress", "Awaiting User"];

export interface Admin {
  id: string;
  twoFactorEnabled?: boolean | null;
  sessionId: string;
  /** A founder may decide other admins' verifications; other admins may not. */
  founder?: boolean;
}

/** Sanitised for logs: the error's kind, never a message that might carry details. */
const kind = (e: unknown) => (e instanceof Error ? e.name : "error");

/** A 403 the web can act on, such as asking for a fresh two-factor code. */
const forbidden = (code: string, message: string) =>
  new ForbiddenException({ statusCode: 403, code, message });

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
    @Inject(AUTH) private readonly auth: Auth,
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
    const [snapshot, consented, withdrawable, latest] = await Promise.all([
      this.repo.snapshot(userId),
      this.repo.hasConsent(userId),
      this.repo.hasAnyConsent(userId),
      this.repo.latestAttempt(userId),
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
    const status = outdated ? ("outdated" as const) : (state?.status ?? ("not_started" as const));
    const attemptsUsed = state?.attemptsUsed ?? 0;
    const current = latest && latest.id === state?.currentAttemptId ? latest : null;
    return {
      available: this.config.availableTo(userId),
      status,
      attemptsUsed,
      attemptsRemaining: Math.max(0, BRONZE_MAX_ATTEMPTS - attemptsUsed),
      consented,
      withdrawable,
      policyVersion: BRONZE_POLICY_VERSION,
      policyUrl: this.didit.policyUrl || null,
      missing,
      photoReadyAt:
        uploadedAt && uploadedAt + PHOTO_SETTLE_MS > now
          ? new Date(uploadedAt + PHOTO_SETTLE_MS).toISOString()
          : null,
      // Closed Didit midway: they can carry on in the same session.
      resumable:
        status === "pending" &&
        Boolean(current?.providerJobId.startsWith("didit:")) &&
        RESUMABLE.includes(current?.providerStatus ?? "Not Started"),
      lastFailure:
        status === "failed" || status === "rejected"
          ? memberFailureReason(
              latest && {
                status: latest.status,
                failureCodes: latest.failureCodes,
                checks: latest.checks as Partial<BronzeChecks>,
              },
            )
          : null,
    };
  }

  /** The same Didit session again, for a member who closed it before finishing. */
  async resume(userId: string) {
    const state = await this.repo.state(userId);
    const attempt =
      state?.status === "pending" && state.currentAttemptId
        ? await this.repo.attempt(state.currentAttemptId)
        : null;
    if (!attempt?.providerJobId.startsWith("didit:"))
      throw new ConflictException("There's no verification to continue.");
    const session = await this.didit.decision(attempt.providerJobId.slice(6));
    const status = String(session.status);
    await this.repo.noteProviderStatus(attempt.id, status);
    const url = typeof session.session_url === "string" ? session.session_url : "";
    if (!RESUMABLE.includes(status) || !/^https:\/\/verify\.didit\.me\//.test(url))
      throw new ConflictException(
        "This verification can't be continued. Refresh to see where it is.",
      );
    return { url };
  }

  async consent(userId: string, accepted: boolean, version: string) {
    if (accepted !== true || version !== BRONZE_POLICY_VERSION) {
      throw new BadRequestException("The current verification consent is required.");
    }
    if (!this.config.availableTo(userId)) {
      throw new ServiceUnavailableException("Verification isn't available yet.");
    }
    await this.repo.consent(userId);
    return this.status(userId);
  }

  /** Withdrawing ends the check and the badge, and erases the member's sessions at Didit. */
  async withdraw(userId: string) {
    await this.repo.withdrawConsent(userId);
    // Erasure is queued durably; trying it now mustn't hold up the member.
    void this.processErasures();
    return this.status(userId);
  }

  /**
   * Before an account is deleted: durably queue every provider session. With
   * a ban, the identity is also held, so it can't be verified on a new account
   * without an admin looking.
   */
  async forgetMember(userId: string, opts: { hold?: boolean } = {}) {
    if (opts.hold) await this.repo.holdIdentities(userId);
    await this.repo.queueErasuresForUser(userId);
  }

  private async processErasures() {
    let due: Awaited<ReturnType<BronzeRepository["claimErasures"]>>;
    try {
      due = await this.repo.claimErasures(20);
    } catch (e) {
      this.logger.warn(`Verification erasure queue skipped (${kind(e)})`);
      return;
    }
    for (const erasure of due) {
      try {
        await this.didit.deleteSession(erasure.providerSessionId);
        await this.repo.completeErasure(erasure.id);
      } catch (e) {
        await this.repo.failErasure(erasure.id, kind(e)).catch(() => undefined);
        this.logger.warn(`Provider erasure deferred (${kind(e)})`);
      }
    }
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
    // Reserve first: a burst of taps gets one reservation, so only one start
    // ever goes on to the photo work and the paid session.
    const reservation = await this.repo.reserve(userId, {
      avatarKey: snapshot.avatarKey,
      dob: snapshot.dob,
      gender: snapshot.gender,
      country: snapshot.country,
      nationality: snapshot.nationality,
    });
    if (!reservation)
      throw new ConflictException("Verification state changed. Refresh and try again.");
    try {
      // Every size of the photo comes from the one that gets checked.
      await this.storage.regenerateVariants(snapshot.avatarKey);
    } catch (e) {
      this.logger.warn(`Photo preparation failed (${kind(e)})`);
      await this.repo.cancelReservation(reservation.attemptId);
      throw new ServiceUnavailableException("Couldn't prepare your photo. Please try again.");
    }
    let session: Awaited<ReturnType<DiditService["createSession"]>>;
    try {
      session = await this.didit.createSession(userId);
    } catch (error) {
      await this.repo.cancelReservation(reservation.attemptId);
      throw error;
    }
    let attached = false;
    try {
      attached = await this.repo.attachProviderSession(reservation.attemptId, session.sessionId);
    } catch (e) {
      this.logger.warn(`Attaching the Didit session failed (${kind(e)})`);
    }
    if (!attached) {
      await this.repo.queueErasure(session.sessionId);
      await this.repo.cancelReservation(reservation.attemptId).catch(() => undefined);
      void this.processErasures();
      throw new ConflictException("Verification state changed. Refresh and try again.");
    }
    return { attemptId: reservation.attemptId, provider: "didit" as const, url: session.url };
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

  /**
   * Background safety net: settles attempts whose webhook was missed or failed,
   * releases starts that never got a session, and retries erasures. An old
   * attempt ends only when Didit itself never finished it (it counts), or after
   * an hour of failed reads on our side (it's given back). One timeout never
   * ends it, and nothing Didit's own reviewers are looking at is ever expired.
   */
  async reconcile(now = Date.now()) {
    await this.processErasures();
    try {
      for (const stale of await this.repo.staleReservations(20))
        await this.repo.cancelReservation(stale.id);
    } catch (e) {
      this.logger.warn(`Releasing stale verification starts skipped (${kind(e)})`);
    }
    if (!this.didit.configured) return;
    let due: Awaited<ReturnType<BronzeRepository["claimForReconcile"]>>;
    try {
      due = await this.repo.claimForReconcile(20);
    } catch (e) {
      this.logger.warn(`Verification reconcile skipped (${kind(e)})`);
      return;
    }
    for (const attempt of due) {
      const old = attempt.createdAt.getTime() < now - SESSION_EXPIRY_MS;
      try {
        const outcome = await this.recordDiditDecision(attempt.providerJobId.slice(6));
        if (old && !outcome.terminal && !outcome.inProviderReview && !outcome.busy)
          await this.repo.expireAttempt(attempt.id, "SESSION_EXPIRED");
      } catch (e) {
        this.logger.warn(`Verification reconcile failed for one attempt (${kind(e)})`);
        const run = await this.repo.noteResultFailure(attempt.id).catch(() => null);
        if (
          old &&
          run &&
          run.resultFailures >= RESULT_FAILURES_TO_GIVE_UP &&
          run.providerStatus !== "In Review"
        )
          await this.repo.expireAttempt(attempt.id, "RESULT_UNAVAILABLE").catch(() => undefined);
      }
    }
  }

  private async recordDiditDecision(
    sessionId: string,
  ): Promise<{ terminal: boolean; inProviderReview: boolean; busy?: boolean }> {
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
    await this.repo.noteProviderStatus(attempt.id, String(decision.status));
    const result = interpretDiditResult(decision, {
      country: attempt.profileCountry,
      nationality: attempt.profileNationality,
    });
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
      // Another worker is still comparing the photos; this is no time to expire it.
      if (!match) return { terminal: false, inProviderReview: false, busy: true };
      checks.profileFace = match.outcome === "matched";
      if (!checks.profileFace)
        failureCodes.push(match.reason ?? "PROFILE_PHOTO_MATCH_INCONCLUSIVE");
      if (!checks.country) failureCodes.push("ID_COUNTRY_UNCONFIRMED");
      status = canAwardBronze(checks) ? "verified" : "manual_review";
      // Didit found the same name and birth date under another member of ours.
      if (result.possibleDuplicate) {
        status = "manual_review";
        failureCodes.push("IDENTITY_ON_ANOTHER_ACCOUNT");
      }
      // Whether this identity is on another account is decided under its lock
      // when the result is recorded.
      binding = this.bindingFor(result.identity);
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
    if (recorded) {
      if (recorded.reviewOpened) this.push.newVerificationReview();
      if (recorded.status !== "processing") this.push.verificationUpdate(attempt.userId);
      if (result.underage) this.push.verificationUnderage(attempt.userId);
    }
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

  async stepUp(admin: Admin, code: string, headers: Headers, now = Date.now()) {
    if (!admin.twoFactorEnabled)
      throw forbidden(
        "TWO_FACTOR_OFF",
        "Turn on two-factor authentication (Settings, Security & 2FA) to review verifications.",
      );
    const lockedUntil = await this.repo.stepUpLockedUntil(admin.id);
    if (lockedUntil) throw this.lockedOut(lockedUntil);
    try {
      await this.auth.api.verifyTOTP({ body: { code, trustDevice: false }, headers });
    } catch {
      // Server-side checks skip Better Auth's rate limit, so wrong codes are counted here.
      const locked = await this.repo.recordStepUpFailure(
        admin.id,
        STEP_UP_MAX_FAILURES,
        STEP_UP_WINDOW_MINUTES,
      );
      if (locked) throw this.lockedOut(locked);
      throw forbidden("INVALID_CODE", "That code isn't right. Try the current one.");
    }
    await this.repo.clearStepUpFailures(admin.id);
    const expiresAt = new Date(now + ADMIN_STEP_UP_MS);
    await this.repo.recordAdminStepUp(admin.sessionId, admin.id, expiresAt);
    return { verifiedUntil: expiresAt.toISOString() };
  }

  private lockedOut(until: Date) {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: "STEP_UP_LOCKED",
        message: `Too many wrong codes. Try again in ${STEP_UP_WINDOW_MINUTES} minutes.`,
        retryAt: until.toISOString(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async requireTwoFactor(admin: Admin) {
    if (!admin.twoFactorEnabled)
      throw forbidden(
        "TWO_FACTOR_OFF",
        "Turn on two-factor authentication (Settings, Security & 2FA) to review verifications.",
      );
    if (!(await this.repo.hasActiveAdminStepUp(admin.sessionId, admin.id)))
      throw forbidden(
        "STEP_UP_REQUIRED",
        "Confirm a current two-factor code for this admin session.",
      );
  }

  /**
   * Who may act on this member's verification: never the member themselves,
   * and for another admin's verification, only a founder.
   */
  private async actingOn(admin: Admin, userId: string) {
    const own = admin.id === userId;
    const isProtected = !own && !admin.founder && (await this.repo.adminIds()).includes(userId);
    return { own, protected: isProtected };
  }

  private async mayAct(admin: Admin, userId: string, verb: string) {
    const who = await this.actingOn(admin, userId);
    if (who.own) throw new ForbiddenException(`You can't ${verb} your own verification.`);
    if (who.protected)
      throw new ForbiddenException(`Only a founder can ${verb} an admin's verification.`);
  }

  async reviews(admin: Admin) {
    await this.requireTwoFactor(admin);
    const [rows, adminIds] = await Promise.all([this.repo.openReviews(), this.repo.adminIds()]);
    return Promise.all(
      rows.map(async (row) => {
        const duplicateOf =
          row.identityBinding &&
          (row.reasonCodes as string[]).includes("IDENTITY_ON_ANOTHER_ACCOUNT")
            ? await this.repo.otherHolderOf(row.identityBinding, row.userId)
            : null;
        return {
          id: row.id,
          userId: row.userId,
          username: row.username,
          displayName: row.displayName,
          reasonCodes: row.reasonCodes,
          createdAt: row.createdAt,
          providerSessionId: row.providerJobId.replace(/^didit:/, ""),
          checks: row.checks,
          own: row.userId === admin.id,
          protected: row.userId !== admin.id && !admin.founder && adminIds.includes(row.userId),
          duplicateOf: duplicateOf
            ? { userId: duplicateOf.userId, username: duplicateOf.username ?? null }
            : null,
          // The photo as members see it, and the original it was made from.
          photoUrl: await this.storage.presignReviewDownload(row.avatarKey, "md"),
          originalPhotoUrl: await this.storage.presignReviewDownload(row.avatarKey),
        };
      }),
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
    await this.requireTwoFactor(admin);
    const subject = await this.repo.reviewSubject(input.id);
    if (subject) await this.mayAct(admin, subject, "decide");
    const result = await this.repo.decideReview({ ...input, reviewerId: admin.id });
    if (!result.ok) {
      if (result.reason === "own")
        throw new ForbiddenException("You can't decide your own verification.");
      if (result.reason === "checks")
        throw new ConflictException(
          "This attempt didn't pass the ID checks, so it can't be approved.",
        );
      if (result.reason === "changed") {
        if (subject) this.push.verificationUpdate(subject);
        throw new ConflictException(
          "The member changed their photo, birth date or gender, so this check has ended.",
        );
      }
      if (result.reason === "duplicate")
        throw new ConflictException(
          "Another account was verified with this ID since this review opened. Refresh to see it.",
        );
      throw new ConflictException("This review is already closed.");
    }
    this.push.verificationUpdate(result.userId);
    this.logger.log(`Verification review decided (${input.decision}) by an admin`);
    return { status: result.status };
  }

  async revoke(admin: Admin, userId: string, reason: string) {
    await this.requireTwoFactor(admin);
    await this.mayAct(admin, userId, "revoke");
    if (!(await this.repo.revoke(userId, admin.id, reason)))
      throw new NotFoundException("Nothing to revoke.");
    this.push.verificationUpdate(userId);
    return { status: "revoked" as const };
  }

  async reopen(admin: Admin, userId: string, reason: string) {
    await this.requireTwoFactor(admin);
    await this.mayAct(admin, userId, "reopen");
    if (!(await this.repo.reopen(userId, admin.id, reason)))
      throw new ConflictException("Only a rejected or revoked verification can be reopened.");
    this.push.verificationUpdate(userId);
    return { status: "not_started" as const };
  }

  /** What Moderation shows on a member's page. */
  async adminStatus(admin: Admin, userId: string) {
    const [state, snapshot, who] = await Promise.all([
      this.repo.state(userId),
      this.repo.snapshot(userId),
      this.actingOn(admin, userId),
    ]);
    const outdated =
      state?.status === "verified" &&
      !stillVerified(state, {
        avatarKey: snapshot?.avatarKey ?? null,
        dateOfBirth: snapshot?.dob ?? null,
        gender: snapshot?.gender ?? null,
      });
    return {
      status: outdated ? ("outdated" as const) : (state?.status ?? "not_started"),
      attemptsUsed: state?.attemptsUsed ?? 0,
      own: who.own,
      protected: who.protected,
    };
  }
}
