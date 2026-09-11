import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CommunityModule } from "./community/community.module";
import { DbModule } from "./db/db.module";
import { EmailModule } from "./email/email.module";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";
import { MembersModule } from "./members/members.module";
import { MessagingModule } from "./messaging/messaging.module";
import { PresenceModule } from "./presence/presence.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { StorageModule } from "./storage/storage.module";

//New modules that was added to the app.module.ts file
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { UploadsModule } from './uploads/uploads.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    EmailModule,
    PresenceModule,
    AuthModule,
    MessagingModule,
    StorageModule,
    ProfilesModule,
    CommunityModule,
    MembersModule,
    RedisModule,
    UsersModule,
    ConversationsModule,
    UploadsModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
