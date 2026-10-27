import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { KinkRingsService, giveRingSchema } from "./kink-rings.service";

/** Kink Rings: the member's own, and giving one away (docs/KINK_RINGS.md). */
@Controller("kink-rings")
@UseGuards(AuthGuard)
export class KinkRingsController {
  constructor(private readonly rings: KinkRingsService) {}

  @Get()
  mine(@Req() req: AuthedRequest) {
    return this.rings.mine(req.user.id);
  }

  @Post("give")
  give(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = giveRingSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.rings.give(req.user.id, parsed.data.username);
  }
}
