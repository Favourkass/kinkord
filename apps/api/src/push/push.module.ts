import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { PushController } from "./push.controller";
import { PushService } from "./push.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [RealtimeModule],
  controllers: [PushController, NotificationsController],
  providers: [PushService, NotificationsService],
  exports: [PushService],
})
export class PushModule {}
