import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { CommunityModule } from "./community/community.module";
import { DbModule } from "./db/db.module";
import { EmailModule } from "./email/email.module";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";
import { MembersModule } from "./members/members.module";
import { MessagingModule } from "./messaging/messaging.module";
import { ModerationModule } from "./moderation/moderation.module";
import { PresenceModule } from "./presence/presence.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { OtpModule } from "./otp/otp.module";
import { PostsModule } from "./posts/posts.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    EmailModule,
    ModerationModule,
    PresenceModule,
    AuthModule,
    MessagingModule,
    StorageModule,
    ProfilesModule,
    CommunityModule,
    MembersModule,
    OtpModule,
    PostsModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
