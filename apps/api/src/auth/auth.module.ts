import { Global, Module } from "@nestjs/common";
import { Db, DRIZZLE } from "../db/db.module";
import { EmailService } from "../email/email.service";
import { SignupGuardService } from "../moderation/signup-guard.service";
import { AUTH, buildAuth } from "./auth.instance";
import { AuthExtController } from "./auth-ext.controller";
import { MeController } from "./me.controller";
import { PhoneSignInService } from "./phone-sign-in.service";
import { SignUpService } from "./sign-up.service";

@Global()
@Module({
  controllers: [MeController, AuthExtController],
  providers: [
    {
      provide: AUTH,
      inject: [DRIZZLE, EmailService, SignupGuardService],
      useFactory: (db: Db, email: EmailService, guard: SignupGuardService) =>
        buildAuth(db, email, guard),
    },
    PhoneSignInService,
    SignUpService,
  ],
  exports: [AUTH],
})
export class AuthModule {}
