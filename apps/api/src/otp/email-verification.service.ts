import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { user } from "../db/schema";
import { OtpService } from "./otp.service";

export interface EmailCodeSent {
  otpId: string;
  /** Masked for display: recognisable to the owner, not readable to a shoulder. */
  sentTo: string;
  expiresAt: string;
  resendAfterMs: number;
}

/** t***a@kinkord.com — enough to recognise, not enough to harvest. */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}${"*".repeat(Math.min(name.length - 2, 5))}${name.at(-1)}@${domain}`;
}

/**
 * Email verification by 6-digit code (Favour, 2026-09-15), replacing Better
 * Auth's click-a-link message: typing a code keeps members inside the app
 * instead of sending them out to a mail client and back.
 *
 * The address is read from the session, never from the request, so this cannot
 * be pointed at anyone else's inbox.
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly otp: OtpService,
  ) {}

  private async accountFor(userId: string) {
    const [row] = await this.db
      .select({ email: user.email, verified: user.emailVerified })
      .from(user)
      .where(eq(user.id, userId));
    if (!row) throw new BadRequestException("Account not found");
    return row;
  }

  async sendCode(userId: string): Promise<EmailCodeSent> {
    const { email, verified } = await this.accountFor(userId);
    if (verified) throw new BadRequestException("Your email address is already verified");

    const challenge = await this.otp.send(userId, "email", email);
    return {
      otpId: challenge.id,
      sentTo: maskEmail(email),
      expiresAt: challenge.expiresAt,
      resendAfterMs: challenge.resendAfterMs,
    };
  }

  async verify(userId: string, otpId: string, code: string) {
    const result = await this.otp.verify(userId, otpId, code);
    if (!result.valid) return { verified: false, attemptsLeft: result.attemptsLeft ?? null };

    await this.db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
    return { verified: true, attemptsLeft: null };
  }
}
