import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { PushController } from "./push.controller";
import { PushDigestService } from "./push-digest.service";
import { PushPreferencesService } from "./push-preferences.service";
import { PushScheduleService } from "./push-schedule.service";
import { PushService } from "./push.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [RealtimeModule],
  controllers: [PushController, NotificationsController],
  providers: [
    PushService,
    NotificationsService,
    PushScheduleService,
    PushPreferencesService,
    PushDigestService,
  ],
  exports: [PushService],
})
export class PushModule {}
