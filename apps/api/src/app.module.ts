import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { DbModule } from "./db/db.module";
import { EmailModule } from "./email/email.module";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";
import { MessagingModule } from "./messaging/messaging.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    EmailModule,
    AuthModule,
    MessagingModule,
    StorageModule,
    ProfilesModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
