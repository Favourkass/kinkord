import { Module } from "@nestjs/common";
import { BronzeController, BronzeReviewController, DiditCallbackController, SmileIdCallbackController } from "./bronze.controller";
import { BronzeRepository } from "./bronze.repository";
import { BronzeService } from "./bronze.service";
import { SmileIdService } from "./smile-id.service";
import { DiditService } from "./didit.service";

@Module({
  controllers: [BronzeController, BronzeReviewController, DiditCallbackController, SmileIdCallbackController],
  providers: [BronzeRepository, BronzeService, DiditService, SmileIdService],
})
export class VerificationModule {}
