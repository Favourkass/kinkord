import { Global, Module } from "@nestjs/common";
import { SignupGuardService } from "./signup-guard.service";

/** Global because sign-up (auth) and verification codes (otp) both consult it. */
@Global()
@Module({
  providers: [SignupGuardService],
  exports: [SignupGuardService],
})
export class ModerationModule {}
