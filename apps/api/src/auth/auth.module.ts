import { Global, Module } from "@nestjs/common";
import { Db, DRIZZLE } from "../db/db.module";
import { EmailService } from "../email/email.service";
import { AUTH, buildAuth } from "./auth.instance";
import { MeController } from "./me.controller";

@Global()
@Module({
  controllers: [MeController],
  providers: [
    {
      provide: AUTH,
      inject: [DRIZZLE, EmailService],
      useFactory: (db: Db, email: EmailService) => buildAuth(db, email),
    },
  ],
  exports: [AUTH],
})
export class AuthModule {}
