import { Module } from "@nestjs/common";
import { OtpController } from "./otp.controller";
import { OtpService } from "./otp.service";
import { PhoneVerificationService } from "./phone-verification.service";

@Module({
  controllers: [OtpController],
  providers: [OtpService, PhoneVerificationService],
  exports: [OtpService],
})
export class OtpModule {}
