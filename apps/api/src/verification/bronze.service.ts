import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { StorageService } from "../storage/storage.service";
import { BronzeRepository } from "./bronze.repository";
import { BRONZE_MAX_ATTEMPTS, BRONZE_POLICY_VERSION, canAwardBronze, emptyBronzeChecks, interpretDiditResult, interpretSmileResult, matchIdentity, type BronzeChecks } from "./bronze-policy";
import { SmileIdService } from "./smile-id.service";
import { DiditService } from "./didit.service";

@Injectable()
export class BronzeService {
  private readonly logger = new Logger(BronzeService.name);
  constructor(private readonly repo: BronzeRepository, private readonly smile: SmileIdService,
    private readonly didit: DiditService,
    private readonly storage: StorageService) {}

  private reviewer(user: { id: string; email: string; twoFactorEnabled?: boolean | null }) {
    const allowlist = (process.env.BRONZE_REVIEWER_EMAILS ?? "").split(",")
      .map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (!allowlist.includes(user.email.toLowerCase()) || !user.twoFactorEnabled) {
      throw new ForbiddenException("Bronze review requires an authorized, 2FA-enabled account.");
    }
  }

  async reviews(user: { id: string; email: string; twoFactorEnabled?: boolean | null }) {
    this.reviewer(user);
    this.logger.log(`Bronze review queue accessed by reviewer ${user.id}`);
    const rows = await this.repo.openReviews();
    return Promise.all(rows.map(async (row) => ({
      id: row.id, userId: row.userId, attemptId: row.attemptId,
      reasonCodes: row.reasonCodes, createdAt: row.createdAt,
      providerJobId: row.providerJobId, checks: row.checks,
      profilePhotoUrl: await this.storage.presignDownload(row.avatarKey),
    })));
  }

  async decideReview(user: { id: string; email: string; twoFactorEnabled?: boolean | null },
    input: { id: string; decision: "approve" | "reject"; profileFaceMatches: boolean;
      evidenceReference: string; reason: string }) {
    this.reviewer(user);
    const result = await this.repo.decideReview({ ...input, reviewerId: user.id });
    if (!result) throw new ConflictException("The review is no longer open or the required checks did not pass.");
    this.logger.log(`Bronze review ${input.id} decided ${input.decision} by reviewer ${user.id}`);
    return result;
  }

  async status(userId: string) {
    let [state, snapshot, consent] = await Promise.all([
      this.repo.status(userId), this.repo.snapshot(userId), this.repo.hasConsent(userId),
    ]);
    if (state?.status === "pending" && state.currentAttemptId && this.didit.configured) {
      const attempt = await this.repo.attempt(state.currentAttemptId);
      if (attempt?.providerJobId.startsWith("didit:")) {
        try {
          await this.recordDiditDecision(attempt.providerJobId.slice(6));
          state = await this.repo.status(userId);
        } catch (error) {
          this.logger.warn(`Didit status refresh deferred: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      }
    }
    const missing = [
      (!snapshot?.avatarKey || !snapshot.avatarUploadedAt ||
        snapshot.avatarUploadedAt.getTime() < Date.now() - 90 * 24 * 60 * 60 * 1000) && "profilePhoto",
      !snapshot?.dob && "dateOfBirth",
      !snapshot?.gender && "gender",
      !snapshot?.country && "country",
    ].filter((value): value is string => typeof value === "string");
    return {
      status: state?.status === "verified" && state.verifiedAvatarKey !== snapshot?.avatarKey
        ? "manual_review" : state?.status ?? "not_started",
      attemptsUsed: state?.attemptsUsed ?? 0,
      attemptsRemaining: BRONZE_MAX_ATTEMPTS - (state?.attemptsUsed ?? 0),
      consented: consent,
      policyVersion: BRONZE_POLICY_VERSION,
      missing,
      providerAvailable: this.didit.configured || this.smile.configured,
      provider: this.didit.configured ? "didit" : this.smile.configured ? "smile" : null,
      policyUrl: this.didit.policyUrl || this.smile.policyUrl || null,
      // The private provider result does not leave this endpoint.
    };
  }

  async consent(userId: string, accepted: boolean, version: string) {
    if (accepted !== true || version !== BRONZE_POLICY_VERSION) {
      throw new BadRequestException("The current Bronze verification consent is required.");
    }
    await this.repo.consent(userId);
    return this.status(userId);
  }

  async start(userId: string) {
    const status = await this.status(userId);
    if (status.missing.length) throw new BadRequestException({ message: "Complete your profile and add a recent photo first.", missing: status.missing });
    if (!status.consented) throw new BadRequestException("Consent is required before verification.");
    if (status.status === "pending") throw new ConflictException("Verification is already in progress.");
    if (status.status === "verified" || status.status === "manual_review" || !status.attemptsRemaining) {
      throw new ConflictException("Automated verification is not available for this account.");
    }
    const snapshot = await this.repo.snapshot(userId);
    if (!snapshot?.avatarKey || !snapshot.avatarUploadedAt ||
        snapshot.avatarUploadedAt.getTime() < Date.now() - 90 * 24 * 60 * 60 * 1000 ||
        !snapshot.dob || !snapshot.gender || !snapshot.country) {
      throw new BadRequestException("Complete your profile first.");
    }
    let launch: { provider: "didit"; url: string } | { provider: "smile"; token: string; product: "biometric_kyc";
      environment: "sandbox" | "live"; partnerId: string; callbackUrl: string; policyUrl: string };
    let jobId: string;
    if (this.didit.configured) {
      try {
        const session = await this.didit.createSession(userId);
        jobId = `didit:${session.sessionId}`;
        launch = { provider: "didit", url: session.url };
      } catch (error) {
        if (!this.smile.configured) throw error;
        this.logger.warn("Didit session unavailable; using configured Smile ID fallback.");
        jobId = randomUUID();
        launch = await this.smileLaunch(userId, jobId);
      }
    } else {
      jobId = randomUUID();
      launch = await this.smileLaunch(userId, jobId);
    }
    const attemptId = await this.repo.reserve(userId, {
      avatarKey: snapshot.avatarKey, dob: snapshot.dob,
      gender: snapshot.gender, country: snapshot.country,
    }, jobId);
    if (!attemptId) throw new ConflictException("Verification state changed. Refresh and try again.");
    return { attemptId, ...launch };
  }

  private async smileLaunch(userId: string, jobId: string) {
    // Minting the token before reservation avoids charging an attempt for a provider outage.
    const token = await this.smile.webToken(userId, jobId);
    return { provider: "smile" as const, token, product: "biometric_kyc" as const,
      environment: this.smile.environment, partnerId: this.smile.partnerId,
      callbackUrl: this.smile.callbackUrl, policyUrl: this.smile.policyUrl };
  }

  async diditCallback(body: Buffer, signature: string | undefined, timestamp: string | undefined) {
    this.didit.verifyWebhook(body, signature, timestamp);
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(body.toString("utf8")) as Record<string, unknown>; }
    catch { throw new BadRequestException("Invalid Didit callback"); }
    if (typeof payload.session_id !== "string") throw new BadRequestException("Missing Didit session");
    await this.recordDiditDecision(payload.session_id);
    return { received: true };
  }

  private async recordDiditDecision(sessionId: string) {
    const attempt = await this.repo.findAttempt(`didit:${sessionId}`);
    if (!attempt) throw new NotFoundException("Unknown Didit session");
    const decision = await this.didit.decision(sessionId);
    if (decision.session_id !== sessionId || decision.session_kind !== "user" ||
        decision.vendor_data !== attempt.userId || decision.workflow_id !== process.env.DIDIT_WORKFLOW_ID) {
      throw new BadRequestException("Mismatched Didit decision");
    }
    const result = interpretDiditResult(decision, attempt.profileCountry);
    if (!result.terminal) return;
    const identity = matchIdentity(result.identity, {
      dob: attempt.profileDob, gender: attempt.profileGender, country: attempt.profileCountry,
    });
    const checks: BronzeChecks = {
      ...emptyBronzeChecks(), governmentId: result.governmentId,
      liveness: result.liveness, idFace: result.idFace,
      dateOfBirth: identity.dateOfBirth, gender: identity.gender, country: identity.country,
    };
    const primaryPassed = checks.governmentId && checks.liveness && checks.idFace &&
      checks.dateOfBirth && checks.gender && checks.country;
    const failureCodes = result.failed ? ["DIDIT_DECLINED"] : !primaryPassed ? ["DIDIT_REQUIRED_CHECK_MISSING"] :
      ["PROFILE_PHOTO_FACE_MATCH_REQUIRED"];
    const fingerprint = createHash("sha256").update(JSON.stringify({ sessionId, status: decision.status,
      checks })).digest("hex");
    await this.repo.recordCallback({
      attemptId: attempt.id, userId: attempt.userId, fingerprint,
      resultCode: String(decision.status), checks,
      status: result.failed || !primaryPassed ? "failed" : "manual_review", failureCodes,
    });
  }

  async smileCallback(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequestException("Invalid callback");
    const payload = body as Record<string, unknown>;
    this.smile.verifyCallback(payload);
    const params = payload.PartnerParams;
    if (!params || typeof params !== "object" || Array.isArray(params)) throw new BadRequestException("Missing job reference");
    const jobId = (params as Record<string, unknown>).job_id;
    if (typeof jobId !== "string") throw new BadRequestException("Invalid job reference");
    const attempt = await this.repo.findAttempt(jobId);
    if (!attempt) throw new NotFoundException("Unknown verification job");
    if ((params as Record<string, unknown>).user_id !== attempt.userId) {
      throw new BadRequestException("Mismatched verification user");
    }
    const providerResults = await this.smile.jobResults(attempt.userId, jobId);
    const official = providerResults.find((entry) => entry.ResultCode === payload.ResultCode);
    if (!official) {
      // Smile retries non-2xx callbacks; an unverifiable or not-yet-available
      // status must never progress an account's identity decision.
      throw new ServiceUnavailableException("Provider job status is not ready yet.");
    }
    const trusted = official;
    const result = interpretSmileResult(trusted);
    const identity = matchIdentity(trusted, {
      dob: attempt.profileDob, gender: attempt.profileGender, country: attempt.profileCountry,
    });
    const previous = attempt.checks as Partial<BronzeChecks>;
    const checks: BronzeChecks = {
      ...emptyBronzeChecks(), ...previous,
      governmentId: Boolean(previous.governmentId || result.verified),
      liveness: Boolean(previous.liveness || result.live),
      idFace: Boolean(previous.idFace || result.face),
      dateOfBirth: Boolean(previous.dateOfBirth || identity.dateOfBirth),
      gender: Boolean(previous.gender || identity.gender),
      country: Boolean(previous.country || identity.country),
      // Never infer a profile-photo match from a government ID face match.
      profileFace: Boolean(previous.profileFace),
    };
    const mismatch = (typeof trusted.DOB === "string" && !identity.dateOfBirth) ||
      (typeof trusted.Gender === "string" && !identity.gender) ||
      (typeof trusted.Country === "string" && !identity.country);
    const primaryPassed = checks.governmentId && checks.liveness && checks.idFace &&
      checks.dateOfBirth && checks.gender && checks.country;
    const failureCodes = result.failed || mismatch ? [result.code || "IDENTITY_MISMATCH"] : [];
    const needsReview = primaryPassed && !checks.profileFace;
    const status = result.failed || mismatch
      ? attempt.number >= BRONZE_MAX_ATTEMPTS ? "manual_review" as const : "failed" as const
      : canAwardBronze(checks) ? "verified" as const
      : needsReview ? "manual_review" as const
      : "processing" as const;
    if (needsReview) failureCodes.push("PROFILE_PHOTO_FACE_MATCH_REQUIRED");
    const fingerprint = createHash("sha256").update(JSON.stringify({
      jobId, code: result.code, timestamp: payload.timestamp, actions: trusted.Actions,
      dob: trusted.DOB, gender: trusted.Gender, country: trusted.Country,
    })).digest("hex");
    await this.repo.recordCallback({
      attemptId: attempt.id, userId: attempt.userId, fingerprint,
      resultCode: result.code, checks, status, failureCodes,
    });
    return { received: true };
  }
}
