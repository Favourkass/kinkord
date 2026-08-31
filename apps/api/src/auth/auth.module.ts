import { Global, Module } from "@nestjs/common";
import { Db, DRIZZLE } from "../db/db.module";
import { EmailService } from "../email/email.service";
import { AUTH, buildAuth } from "./auth.instance";
import { AuthExtController } from "./auth-ext.controller";
import { MeController } from "./me.controller";
import { PhoneSignInService } from "./phone-sign-in.service";

@Global()
@Module({
  controllers: [MeController, AuthExtController],
  providers: [
    {
      provide: AUTH,
      inject: [DRIZZLE, EmailService],
      useFactory: (db: Db, email: EmailService) => buildAuth(db, email),
    },
    PhoneSignInService,
  ],
  exports: [AUTH],
})
export class AuthModule {}
