import { Module } from "@nestjs/common";
import { PushController } from "./push.controller";
import { PushService } from "./push.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [PushController, NotificationsController],
  providers: [PushService, NotificationsService],
  exports: [PushService],
})
export class PushModule {}
