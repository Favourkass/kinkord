import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { isSuperAdmin } from "../moderation/admins";
import { BronzeService } from "./bronze.service";

const consentSchema = z.object({
  accepted: z.literal(true),
  policyVersion: z.string().trim().min(1).max(128),
});

@Controller("verification/bronze")
@UseGuards(AuthGuard)
export class BronzeController {
  constructor(private readonly bronze: BronzeService) {}

  @Get("status") status(@Req() req: AuthedRequest) {
    return this.bronze.status(req.user.id);
  }

  @Post("consent") consent(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = consentSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException("The current verification consent is required.");
    return this.bronze.consent(req.user.id, true, parsed.data.policyVersion);
  }

  @Post("consent/withdraw") withdraw(@Req() req: AuthedRequest) {
    return this.bronze.withdraw(req.user.id);
  }

  @Post("attempts") start(@Req() req: AuthedRequest) {
    return this.bronze.start(req.user.id);
  }

  /** The same Didit session again, for a member who closed it before finishing. */
  @Post("attempts/resume") resume(@Req() req: AuthedRequest) {
    return this.bronze.resume(req.user.id);
  }
}

@Controller("webhooks/didit")
export class DiditCallbackController {
  constructor(private readonly bronze: BronzeService) {}

  /** The body arrives as raw bytes (main.ts), because Didit signs exactly those. */
  @Post() callback(
    @Body() body: unknown,
    @Headers("x-signature-v2") signatureV2?: string,
    @Headers("x-signature") signatureRaw?: string,
    @Headers("x-timestamp") timestamp?: string,
  ) {
    return this.bronze.diditCallback(body, signatureV2, signatureRaw, timestamp);
  }
}

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  evidenceReference: z.string().trim().min(3).max(256),
  reason: z.string().trim().min(10).max(1000),
});
const uuid = z.string().uuid();
const userId = z.string().trim().min(1).max(64);
const stepUpSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
const actionSchema = z.object({ reason: z.string().trim().min(10).max(1000) });
const admin = (req: AuthedRequest) => ({
  id: req.user.id,
  twoFactorEnabled: req.user.twoFactorEnabled,
  sessionId: req.session.id,
  founder: isSuperAdmin(req.user),
});

/** Verification reviews, for the same admins who moderate. */
@Controller("admin/verification")
@UseGuards(AuthGuard, AdminGuard)
export class BronzeAdminController {
  constructor(private readonly bronze: BronzeService) {}

  @Post("step-up") stepUp(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = stepUpSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("A valid six-digit code is required.");
    return this.bronze.stepUp(admin(req), parsed.data.code, fromNodeHeaders(req.headers));
  }

  @Get("reviews") reviews(@Req() req: AuthedRequest) {
    return this.bronze.reviews(admin(req));
  }

  @Post("reviews/:id/decision") decide(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = decisionSchema.safeParse(body);
    if (!uuid.safeParse(id).success || !parsed.success)
      throw new BadRequestException("A decision, an evidence reference and a reason are required.");
    return this.bronze.decideReview(admin(req), { id, ...parsed.data });
  }

  @Get("members/:userId") member(@Req() req: AuthedRequest, @Param("userId") id: string) {
    if (!userId.safeParse(id).success) throw new BadRequestException("Invalid member.");
    return this.bronze.adminStatus(admin(req), id);
  }

  @Post("members/:userId/revoke") revoke(
    @Req() req: AuthedRequest,
    @Param("userId") id: string,
    @Body() body: unknown,
  ) {
    const parsed = actionSchema.safeParse(body);
    if (!userId.safeParse(id).success || !parsed.success)
      throw new BadRequestException("A valid member and reason are required.");
    return this.bronze.revoke(admin(req), id, parsed.data.reason);
  }

  @Post("members/:userId/reopen") reopen(
    @Req() req: AuthedRequest,
    @Param("userId") id: string,
    @Body() body: unknown,
  ) {
    const parsed = actionSchema.safeParse(body);
    if (!userId.safeParse(id).success || !parsed.success)
      throw new BadRequestException("A valid member and reason are required.");
    return this.bronze.reopen(admin(req), id, parsed.data.reason);
  }
}
