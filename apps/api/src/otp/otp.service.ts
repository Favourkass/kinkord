import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { otpChallenge } from "../db/schema";
import { EmailService } from "../email/email.service";
import { SmsService } from "../messaging/sms.service";

export type OtpChannel = "email" | "sms";

const OTP_TTL_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 3;
const SEND_COOLDOWN_MS = 60 * 1000;
const MAX_DESTINATION_SENDS_PER_HOUR = 5;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9]\d{7,14}$/;

class TooManyOtpRequestsException extends HttpException {
  constructor(message: string) {
    super(message, 429);
  }
}

function normalizeDestination(channel: OtpChannel, destination: string) {
  const normalized = destination.trim().toLowerCase();
  if (channel === "email" && emailPattern.test(normalized)) return normalized;
  if (channel === "sms" && phonePattern.test(normalized)) return normalized;
  throw new BadRequestException(
    channel === "email"
      ? "A valid email address is required"
      : "A valid E.164 phone number is required",
  );
}

function hashCode(code: string) {
  return createHash("sha256")
    .update(`${process.env.OTP_SECRET ?? process.env.AUTH_SECRET ?? "dev-otp-secret"}:${code}`)
    .digest("hex");
}

function code() {
  return String(randomInt(100000, 1000000));
}

@Injectable()
export class OtpService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  async send(channel: OtpChannel, destination: string, clientIp: string) {
    const normalized = normalizeDestination(channel, destination);
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = await this.db
      .select({ createdAt: otpChallenge.createdAt })
      .from(otpChallenge)
      .where(and(eq(otpChallenge.destination, normalized), gte(otpChallenge.createdAt, hourAgo)))
      .orderBy(sql`${otpChallenge.createdAt} desc`);

    if (recent[0] && now.getTime() - recent[0].createdAt.getTime() < SEND_COOLDOWN_MS) {
      throw new TooManyOtpRequestsException("Please wait before requesting another code");
    }
    if (recent.length >= MAX_DESTINATION_SENDS_PER_HOUR) {
      throw new TooManyOtpRequestsException("Too many verification codes requested");
    }
    if (!this.allowIp(clientIp, now.getTime())) {
      throw new TooManyOtpRequestsException("Too many verification codes requested");
    }

    const value = code();
    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    if (channel === "sms") {
      await this.sms.send({
        to: normalized,
        message: `Your Kinkord verification code is ${value}. It expires in 10 minutes.`,
      });
    } else {
      await this.email.send({
        to: normalized,
        subject: "Your Kinkord verification code",
        text: `Your Kinkord verification code is ${value}. It expires in 10 minutes.`,
        html: `<p>Your Kinkord verification code is <strong>${value}</strong>.</p><p>It expires in 10 minutes.</p>`,
      });
    }
    await this.db.insert(otpChallenge).values({
      id,
      channel,
      destination: normalized,
      codeHash: hashCode(value),
      expiresAt,
    });
    return { id, channel, expiresAt: expiresAt.getTime() };
  }

  async verify(channel: OtpChannel, id: string, value: string) {
    if (!/^\d{6}$/.test(value)) return this.invalidCode();
    const now = new Date();
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(otpChallenge)
        .where(and(eq(otpChallenge.id, id), eq(otpChallenge.channel, channel)))
        .for("update");
      const challenge = rows[0];
      if (!challenge || challenge.expiresAt <= now) return false;
      if (challenge.lockedUntil && challenge.lockedUntil > now) {
        throw new TooManyOtpRequestsException("Verification is locked for 24 hours");
      }
      const storedHash = Buffer.from(challenge.codeHash);
      const computedHash = Buffer.from(hashCode(value));
      const matches =
        storedHash.length === computedHash.length && timingSafeEqual(storedHash, computedHash);
      if (matches) {
        await tx.delete(otpChallenge).where(eq(otpChallenge.id, id));
        return true;
      }
      const failedAttempts = challenge.failedAttempts + 1;
      await tx
        .update(otpChallenge)
        .set({
          failedAttempts,
          lockedUntil:
            failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MS) : null,
        })
        .where(eq(otpChallenge.id, id));
      if (failedAttempts >= MAX_FAILED_ATTEMPTS)
        throw new TooManyOtpRequestsException("Verification is locked for 24 hours");
      return false;
    });
  }

  private readonly ipBuckets = new Map<string, number[]>();

  private allowIp(ip: string, now: number) {
    const recent = (this.ipBuckets.get(ip) ?? []).filter((time) => now - time < 60 * 60 * 1000);
    if (recent.length >= 10) return false;
    recent.push(now);
    this.ipBuckets.set(ip, recent);
    return true;
  }

  private invalidCode(): false {
    throw new UnprocessableEntityException("Invalid verification code");
  }
}
