import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { SilverChecksController } from "./silver-checks.controller";
import { SilverChecksService } from "./silver-checks.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

/** Silver by bank transfer: members pay and send proof, admins check it and turn Silver on. */
@Module({
  imports: [PushModule],
  controllers: [SubscriptionsController, PaymentsController, SilverChecksController],
  providers: [SubscriptionsService, PaymentsService, SilverChecksService],
  // /me reports the member's plan; a profile change puts their check on hold.
  exports: [SubscriptionsService, SilverChecksService],
})
export class SubscriptionsModule {}
