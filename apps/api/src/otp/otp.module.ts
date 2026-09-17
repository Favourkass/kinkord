import { Module } from "@nestjs/common";
import { EmailVerificationController, OtpController } from "./otp.controller";
import { EmailVerificationService } from "./email-verification.service";
import { OtpService } from "./otp.service";
import { PhoneVerificationService } from "./phone-verification.service";

@Module({
  controllers: [OtpController, EmailVerificationController],
  providers: [OtpService, PhoneVerificationService, EmailVerificationService],
  exports: [OtpService],
})
export class OtpModule {}
