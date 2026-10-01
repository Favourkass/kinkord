import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { BlocksService } from "./blocks.service";
import { ReportsService } from "./reports.service";
import { SafetyController } from "./safety.controller";

/** Blocking and reporting. The moderators' side of reports lives in the admin routes. */
@Module({
  imports: [PushModule],
  controllers: [SafetyController],
  providers: [BlocksService, ReportsService],
  exports: [BlocksService, ReportsService],
})
export class SafetyModule {}
