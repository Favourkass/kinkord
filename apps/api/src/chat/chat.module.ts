import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [RealtimeModule, PushModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
