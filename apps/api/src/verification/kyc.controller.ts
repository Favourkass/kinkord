import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { KycService } from "./kyc.service";
import { KycFinancialService } from "./kyc-financial.service";
import { KycReviewService } from "./kyc-review.service";
import { KycLocationService } from "./kyc-location.service";

const consentSchema = z.object({
  category: z.enum(["location", "residence", "financial"]),
  policyVersion: z.string().trim().min(1).max(128),
});

const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180),
  accuracyMetres: z.number().finite().positive().max(10_000),
});

@Controller("verification/kyc")
@UseGuards(AuthGuard)
export class KycController {
  constructor(private readonly kyc: KycService, private readonly location: KycLocationService,
    private readonly financial: KycFinancialService) {}

  @Get("status") status(@Req() req: AuthedRequest) { return this.kyc.status(req.user.id); }

  @Post("consents") consent(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = consentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("A valid KYC consent category and policy version are required.");
    return this.kyc.consent(req.user.id, parsed.data.category, parsed.data.policyVersion);
  }

  @Post("location") locationEvidence(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("A valid live-location result is required.");
    return this.location.capture(req.user.id, parsed.data);
  }

  @Post("residence/refresh") residenceRefresh(@Req() req: AuthedRequest) {
    return this.kyc.refreshResidence(req.user.id);
  }

  @Post("financial/attempts") financialAttempt(@Req() req: AuthedRequest) {
    return this.financial.start(req.user);
  }
}

@Controller("webhooks/mono")
export class MonoCallbackController {
  constructor(private readonly financial: KycFinancialService) {}

  @Post() callback(@Body() body: unknown, @Headers("mono-webhook-secret") secret?: string) {
    return this.financial.webhook(body, secret);
  }
}

const reviewDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  evidenceReference: z.string().trim().min(3).max(256),
  reason: z.string().trim().min(10).max(1000),
});

@Controller("verification/kyc/reviews")
@UseGuards(AuthGuard)
export class KycReviewController {
  constructor(private readonly reviews: KycReviewService) {}

  @Get() list(@Req() req: AuthedRequest) { return this.reviews.list(req.user); }

  @Post(":id/decision") decide(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    const parsed = reviewDecisionSchema.safeParse(body);
    if (!z.string().uuid().safeParse(id).success || !parsed.success) {
      throw new BadRequestException("A valid KYC review decision and evidence reference are required.");
    }
    return this.reviews.decide(req.user, { id, ...parsed.data });
  }
}
