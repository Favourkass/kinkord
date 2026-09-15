import { BadRequestException, HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { otpChallenge } from "../db/schema";
import { EmailService } from "../email/email.service";
import { SmsService } from "../messaging/sms.service";

export type OtpChannel = "email" | "sms";

const OTP_TTL_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 3;
const SEND_COOLDOWN_MS = 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
/** Expired rows are swept opportunistically; nothing else reads them. */
const SWEEP_AFTER_MS = 24 * 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

export class TooManyOtpRequestsException extends HttpException {
  constructor(message: string) {
    super(message, 429);
  }
}

export interface OtpVerifyResult {
  valid: boolean;
  /** Present when the code was wrong, so the UI can warn before the lockout. */
  attemptsLeft?: number;
}

function normalizeDestination(channel: OtpChannel, destination: string) {
  const normalized = destination.trim().toLowerCase();
  if (channel === "email" && EMAIL_RE.test(normalized)) return normalized;
  if (channel === "sms" && E164_RE.test(normalized)) return normalized;
  throw new BadRequestException(
    channel === "email"
      ? "A valid email address is required"
      : "A valid phone number is required, including the country code",
  );
}

/**
 * Salted hash of the code. The salt must be a real secret: without one, anyone
 * who reads the table could rebuild every hash from the million possible codes,
 * so we refuse to issue rather than fall back to a default.
 */
function hashCode(code: string) {
  const secret = process.env.OTP_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("OTP_SECRET or AUTH_SECRET must be set to issue codes");
  return createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

function sixDigits() {
  return String(randomInt(100000, 1000000));
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  /**
   * Issue a code to one of the member's own contact points. The caller decides
   * the destination from data it already trusts (their profile), never from
   * request input — that is what stops this becoming an open SMS relay.
   */
  async send(userId: string, channel: OtpChannel, destination: string) {
    const to = normalizeDestination(channel, destination);
    const now = new Date();
    await this.enforceRate(userId, to, now);

    const code = sixDigits();
    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    // Written before delivery: a code that reached someone but was never stored
    // could not be verified, which looks like a broken app.
    await this.db.insert(otpChallenge).values({
      id,
      userId,
      channel,
      destination: to,
      codeHash: hashCode(code),
      expiresAt,
    });

    try {
      await this.deliver(channel, to, code);
    } catch (error) {
      await this.db.delete(otpChallenge).where(eq(otpChallenge.id, id));
      throw error;
    }

    void this.sweepExpired(now);
    return { id, channel, expiresAt: expiresAt.toISOString(), resendAfterMs: SEND_COOLDOWN_MS };
  }

  /**
   * Redeem a code. Locks the row for the check so two racing requests cannot
   * each spend an attempt against the same counter.
   */
  async verify(userId: string, id: string, code: string): Promise<OtpVerifyResult> {
    if (!/^\d{6}$/.test(code)) return { valid: false };
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(otpChallenge)
        .where(and(eq(otpChallenge.id, id), eq(otpChallenge.userId, userId)))
        .for("update");

      if (!challenge || challenge.expiresAt <= now) return { valid: false };
      if (challenge.lockedUntil && challenge.lockedUntil > now) {
        throw new TooManyOtpRequestsException("Too many wrong codes. Try again in 24 hours.");
      }

      const stored = Buffer.from(challenge.codeHash);
      const offered = Buffer.from(hashCode(code));
      if (stored.length === offered.length && timingSafeEqual(stored, offered)) {
        await tx.delete(otpChallenge).where(eq(otpChallenge.id, id));
        return { valid: true };
      }

      const failedAttempts = challenge.failedAttempts + 1;
      const locked = failedAttempts >= MAX_FAILED_ATTEMPTS;
      await tx
        .update(otpChallenge)
        .set({ failedAttempts, lockedUntil: locked ? new Date(now.getTime() + LOCKOUT_MS) : null })
        .where(eq(otpChallenge.id, id));

      if (locked) {
        throw new TooManyOtpRequestsException("Too many wrong codes. Try again in 24 hours.");
      }
      return { valid: false, attemptsLeft: MAX_FAILED_ATTEMPTS - failedAttempts };
    });
  }

  /**
   * Per-member and per-destination, both read from the table so the limit holds
   * across every instance and survives a restart — an in-process counter would
   * do neither, and behind a load balancer a per-IP one throttles everybody at
   * once because every request arrives from the same proxy address.
   */
  private async enforceRate(userId: string, destination: string, now: Date) {
    const since = new Date(now.getTime() - RATE_WINDOW_MS);
    const recent = await this.db
      .select({ createdAt: otpChallenge.createdAt })
      .from(otpChallenge)
      .where(
        and(
          sql`(${otpChallenge.userId} = ${userId} or ${otpChallenge.destination} = ${destination})`,
          gte(otpChallenge.createdAt, since),
        ),
      )
      .orderBy(sql`${otpChallenge.createdAt} desc`);

    const last = recent[0];
    if (last && now.getTime() - last.createdAt.getTime() < SEND_COOLDOWN_MS) {
      throw new TooManyOtpRequestsException("Please wait a minute before asking for another code.");
    }
    if (recent.length >= MAX_SENDS_PER_WINDOW) {
      throw new TooManyOtpRequestsException("Too many codes requested. Try again later.");
    }
  }

  private async deliver(channel: OtpChannel, to: string, code: string) {
    const line = `Your Kinkord verification code is ${code}. It expires in 10 minutes.`;
    if (channel === "sms") {
      await this.sms.send({ to, message: line });
      return;
    }
    await this.email.send({
      to,
      subject: "Your Kinkord verification code",
      text: line,
      html: `<p>Your Kinkord verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
  }

  /** Best-effort tidy-up; a failure here must never fail the request. */
  private async sweepExpired(now: Date) {
    try {
      await this.db
        .delete(otpChallenge)
        .where(lt(otpChallenge.createdAt, new Date(now.getTime() - SWEEP_AFTER_MS)));
    } catch (error) {
      this.logger.warn(`otp sweep failed: ${String(error)}`);
    }
  }
}
