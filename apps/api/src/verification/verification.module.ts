import { Module } from "@nestjs/common";
import { AdminGuard } from "../moderation/admin.guard";
import { PushModule } from "../push/push.module";
import {
  BronzeAdminController,
  BronzeController,
  DiditCallbackController,
} from "./bronze.controller";
import { BronzeRepository } from "./bronze.repository";
import { BronzeService } from "./bronze.service";
import { DiditService } from "./didit.service";
import { ProfileMatchService } from "./profile-match.service";
import { VerificationConfig } from "./verification-config";

/** Identity verification through Didit; off until its settings say otherwise. */
@Module({
  imports: [PushModule],
  controllers: [BronzeController, DiditCallbackController, BronzeAdminController],
  providers: [
    VerificationConfig,
    BronzeRepository,
    BronzeService,
    DiditService,
    ProfileMatchService,
    AdminGuard,
  ],
  exports: [BronzeService],
})
export class VerificationModule {}
