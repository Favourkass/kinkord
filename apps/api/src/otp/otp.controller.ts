import { BadRequestException, Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { EmailVerificationService } from "./email-verification.service";
import { PhoneVerificationService } from "./phone-verification.service";

const verifySchema = z.object({
  otpId: z.string().trim().uuid(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

/**
 * Phone verification for the signed-in member. There is deliberately no
 * endpoint that takes a destination: the number always comes from the caller's
 * own profile, so this cannot be used to text strangers at our expense.
 */
@Controller("profile/phone")
@UseGuards(AuthGuard)
export class OtpController {
  constructor(private readonly phone: PhoneVerificationService) {}

  @Post("send-code")
  sendCode(@Req() req: AuthedRequest) {
    return this.phone.sendCode(req.user.id);
  }

  @Post("verify")
  verify(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request");
    }
    return this.phone.verify(req.user.id, parsed.data.otpId, parsed.data.code);
  }
}

/**
 * Email verification, same shape as the phone one. The address comes from the
 * session, so a code can only ever be sent to the caller's own inbox.
 */
@Controller("profile/email")
@UseGuards(AuthGuard)
export class EmailVerificationController {
  constructor(private readonly emails: EmailVerificationService) {}

  @Post("send-code")
  sendCode(@Req() req: AuthedRequest) {
    return this.emails.sendCode(req.user.id);
  }

  @Post("verify")
  verify(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request");
    }
    return this.emails.verify(req.user.id, parsed.data.otpId, parsed.data.code);
  }
}
