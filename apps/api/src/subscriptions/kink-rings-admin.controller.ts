import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { isSuperAdmin } from "../moderation/admins";
import { MAX_RINGS } from "./kink-rings";
import { KinkRingsAdminService } from "./kink-rings-admin.service";
import { parse } from "./subscriptions.controller";

const memberId = z.string().trim().min(1).max(64);
const ringId = z.string().uuid("Unknown ring.");
/** Taking back what a member paid for, or was given, always says why. */
const cancelSchema = z.object({ reason: z.string().trim().min(1, "Say why.").max(300) });
const ringCount = z
  .number({ message: `Enter a whole number from 0 to ${MAX_RINGS}.` })
  .int(`Enter a whole number from 0 to ${MAX_RINGS}.`)
  .min(0, `Enter a whole number from 0 to ${MAX_RINGS}.`)
  .max(MAX_RINGS, `Enter a whole number from 0 to ${MAX_RINGS}.`);
const settingsSchema = z.object({ monthly: ringCount, yearly: ringCount }).strict();

/**
 * A member's Kink Rings on their admin page: what each payment brought, who
 * got them, when they run out. Admins can take back the rings a member still
 * has, or the Silver a ring gave.
 */
@Controller("admin")
@UseGuards(AuthGuard, AdminGuard)
export class KinkRingsAdminController {
  constructor(private readonly rings: KinkRingsAdminService) {}

  @Get("kink-rings/settings")
  settings(@Req() req: AuthedRequest) {
    return this.rings.settings(isSuperAdmin(req.user));
  }

  /** What each plan brings is part of its price: founders only. */
  @Put("kink-rings/settings")
  saveSettings(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!isSuperAdmin(req.user)) {
      throw new ForbiddenException("Only the founders can change how many rings a plan brings.");
    }
    return this.rings.saveSettings(req.user.id, parse(settingsSchema, body));
  }

  @Get("members/:id/kink-rings")
  forMember(@Param("id") id: string) {
    return this.rings.forMember(parse(memberId, id));
  }

  @Post("members/:id/kink-rings/cancel")
  cancelUnused(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    const { reason } = parse(cancelSchema, body);
    return this.rings.cancelUnused(parse(memberId, id), req.user.id, reason);
  }

  @Post("kink-rings/:ringId/cancel-silver")
  cancelSilver(@Req() req: AuthedRequest, @Param("ringId") id: string, @Body() body: unknown) {
    const { reason } = parse(cancelSchema, body);
    return this.rings.cancelSilver(parse(ringId, id), req.user.id, reason);
  }
}
