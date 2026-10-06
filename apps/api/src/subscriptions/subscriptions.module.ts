import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

/** Silver by bank transfer: members pay and send proof, admins check it and turn Silver on. */
@Module({
  imports: [PushModule],
  controllers: [SubscriptionsController, PaymentsController],
  providers: [SubscriptionsService, PaymentsService],
  // /me reports the member's plan.
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
