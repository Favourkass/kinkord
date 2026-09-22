import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { PresenceRedisService } from "./presence-redis.service";
import { RealtimePublisher } from "./realtime.publisher";

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, PresenceRedisService, RealtimePublisher],
  exports: [ChatService, PresenceRedisService],
})
export class ChatModule {}
