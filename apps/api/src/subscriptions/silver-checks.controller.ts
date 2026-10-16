import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { SilverChecksService } from "./silver-checks.service";
import { parse } from "./subscriptions.controller";

const memberId = z.string().trim().min(1).max(64);
const removeSchema = z.object({ reason: z.string().trim().max(300).nullish() });

/** The admins' side of Silver checks: the ones waiting for review, and approving or removing one. */
@Controller("admin/silver-checks")
@UseGuards(AuthGuard, AdminGuard)
export class SilverChecksController {
  constructor(private readonly checks: SilverChecksService) {}

  @Get()
  held() {
    return this.checks.held();
  }

  @Get(":userId")
  async member(@Param("userId") userId: string) {
    return { check: await this.checks.forMember(parse(memberId, userId)) };
  }

  @Post(":userId/approve")
  approve(@Req() req: AuthedRequest, @Param("userId") userId: string) {
    return this.checks.approve(req.user.id, parse(memberId, userId));
  }

  @Post(":userId/remove")
  remove(@Req() req: AuthedRequest, @Param("userId") userId: string, @Body() body: unknown) {
    return this.checks.remove(
      req.user.id,
      parse(memberId, userId),
      parse(removeSchema, body).reason,
    );
  }
}
