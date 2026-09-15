import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { profile } from "../db/schema";
import { OtpService } from "./otp.service";

export interface PhoneCodeSent {
  otpId: string;
  /** Masked for display: the member should recognise it without it being readable. */
  sentTo: string;
  expiresAt: string;
  resendAfterMs: number;
}

/** Shows enough of a number to recognise it: +234******3266. */
export function maskPhone(phone: string) {
  const keepEnd = 4;
  if (phone.length <= keepEnd + 4) return phone;
  const head = phone.slice(0, 4);
  const tail = phone.slice(-keepEnd);
  return `${head}${"*".repeat(Math.max(phone.length - head.length - keepEnd, 0))}${tail}`;
}

/**
 * "Basic verified" is earned by proving the phone on the member's own profile
 * (schema note on `profile.phone_verified`). The number is read from the
 * profile, never taken from the request.
 */
@Injectable()
export class PhoneVerificationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly otp: OtpService,
  ) {}

  private async phoneFor(userId: string) {
    const [row] = await this.db
      .select({ phone: profile.phone, verified: profile.phoneVerified })
      .from(profile)
      .where(eq(profile.userId, userId));
    const phone = row?.phone;
    if (!phone) {
      throw new BadRequestException("Add a phone number to your profile first");
    }
    return { phone, verified: row.verified };
  }

  async sendCode(userId: string): Promise<PhoneCodeSent> {
    const { phone, verified } = await this.phoneFor(userId);
    if (verified) throw new BadRequestException("Your phone number is already verified");

    const challenge = await this.otp.send(userId, "sms", phone);
    return {
      otpId: challenge.id,
      sentTo: maskPhone(phone),
      expiresAt: challenge.expiresAt,
      resendAfterMs: challenge.resendAfterMs,
    };
  }

  async verify(userId: string, otpId: string, code: string) {
    const result = await this.otp.verify(userId, otpId, code);
    if (!result.valid) return { verified: false, attemptsLeft: result.attemptsLeft ?? null };

    await this.db.update(profile).set({ phoneVerified: true }).where(eq(profile.userId, userId));
    return { verified: true, attemptsLeft: null };
  }
}
