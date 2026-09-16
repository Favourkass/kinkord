import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { BronzeService } from "./bronze.service";

@Controller("verification/bronze")
@UseGuards(AuthGuard)
export class BronzeController {
  constructor(private readonly bronze: BronzeService) {}

  @Get("status") status(@Req() req: AuthedRequest) { return this.bronze.status(req.user.id); }
  @Post("consent") consent(@Req() req: AuthedRequest, @Body() body: { accepted?: boolean; policyVersion?: string }) {
    return this.bronze.consent(req.user.id, body?.accepted === true, body?.policyVersion ?? "");
  }
  @Post("attempts") start(@Req() req: AuthedRequest) { return this.bronze.start(req.user.id); }
}

@Controller("webhooks/smile-id")
export class SmileIdCallbackController {
  constructor(private readonly bronze: BronzeService) {}
  @Post() callback(@Body() body: unknown) { return this.bronze.smileCallback(body); }
}

@Controller("webhooks/didit")
export class DiditCallbackController {
  constructor(private readonly bronze: BronzeService) {}
  @Post() callback(@Body() body: Buffer,
    @Headers("x-signature") signature?: string, @Headers("x-timestamp") timestamp?: string) {
    return this.bronze.diditCallback(body, signature, timestamp);
  }
}

const reviewDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  profileFaceMatches: z.boolean(),
  evidenceReference: z.string().trim().min(3).max(256),
  reason: z.string().trim().min(10).max(1000),
});

@Controller("verification/bronze/reviews")
@UseGuards(AuthGuard)
export class BronzeReviewController {
  constructor(private readonly bronze: BronzeService) {}

  @Get() list(@Req() req: AuthedRequest) { return this.bronze.reviews(req.user); }

  @Post(":id/decision") decide(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    const parsed = reviewDecisionSchema.safeParse(body);
    if (!z.string().uuid().safeParse(id).success || !parsed.success) {
      throw new BadRequestException("A valid review decision and evidence reference are required.");
    }
    return this.bronze.decideReview(req.user, { id, ...parsed.data });
  }
}
