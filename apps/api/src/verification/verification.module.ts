import { Module } from "@nestjs/common";
import { BronzeController, BronzeReviewController, DiditCallbackController, SmileIdCallbackController } from "./bronze.controller";
import { BronzeRepository } from "./bronze.repository";
import { BronzeService } from "./bronze.service";
import { SmileIdService } from "./smile-id.service";
import { DiditService } from "./didit.service";
import { ProfileMatchService } from "./profile-match.service";
import { KycController, KycReviewController, MonoCallbackController } from "./kyc.controller";
import { KycRepository } from "./kyc.repository";
import { KycService } from "./kyc.service";
import { KycIngestionService } from "./kyc-ingestion.service";
import { KycLocationService } from "./kyc-location.service";
import { MonoService } from "./mono.service";
import { KycFinancialService } from "./kyc-financial.service";
import { KycReviewService } from "./kyc-review.service";

@Module({
  controllers: [BronzeController, BronzeReviewController, DiditCallbackController, SmileIdCallbackController, KycController, MonoCallbackController, KycReviewController],
  providers: [BronzeRepository, BronzeService, DiditService, SmileIdService, ProfileMatchService, KycRepository, KycService, KycIngestionService, KycLocationService, MonoService, KycFinancialService, KycReviewService],
  exports: [KycService, KycRepository],
})
export class VerificationModule {}
