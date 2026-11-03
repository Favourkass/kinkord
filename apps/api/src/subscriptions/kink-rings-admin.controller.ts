import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { KinkRingsAdminService } from "./kink-rings-admin.service";
import { parse } from "./subscriptions.controller";

const memberId = z.string().trim().min(1).max(64);

/** A member's Kink Rings on their admin page: what each payment brought, who got them, when they run out. */
@Controller("admin/members")
@UseGuards(AuthGuard, AdminGuard)
export class KinkRingsAdminController {
  constructor(private readonly rings: KinkRingsAdminService) {}

  @Get(":id/kink-rings")
  forMember(@Param("id") id: string) {
    return this.rings.forMember(parse(memberId, id));
  }
}
