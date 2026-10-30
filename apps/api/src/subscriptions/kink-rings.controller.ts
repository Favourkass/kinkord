import { z } from "zod";
import { KinkRingsInventoryService } from "./kink-rings-inventory.service";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { KinkRingsService, giveRingSchema, giveSelectedRingsSchema } from "./kink-rings.service";

/** Kink Rings: the member's own, and giving one away (docs/KINK_RINGS.md). */
@Controller("kink-rings")
@UseGuards(AuthGuard)
export class KinkRingsController {
  constructor(
    private readonly rings: KinkRingsService,
    private readonly inventoryService: KinkRingsInventoryService,
  ) {}

  @Get()
  mine(@Req() req: AuthedRequest) {
    return this.rings.mine(req.user.id);
  }

  @Get("inventory")
  inventory(@Req() req: AuthedRequest) {
    return this.inventoryService.inventory(req.user.id);
  }
  @Get("history")
  history(@Req() req: AuthedRequest, @Query("page") page?: string) {
    return this.inventoryService.history(req.user.id, pageNumber(page));
  }
  @Get("expired")
  expired(@Req() req: AuthedRequest, @Query("page") page?: string) {
    return this.inventoryService.expired(req.user.id, pageNumber(page));
  }
  @Get("recipients")
  recipients(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = z
      .object({
        tab: z.enum(["friends", "search"]).default("friends"),
        q: z.string().max(64).default(""),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid recipient search.");
    return this.inventoryService.recipients(
      req.user.id,
      parsed.data.tab,
      parsed.data.q,
      parsed.data.page,
    );
  }
  @Post("give-selected")
  giveSelected(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = giveSelectedRingsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.rings.giveSelected(req.user.id, parsed.data.gifts);
  }
  @Post("give")
  give(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = giveRingSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.rings.give(req.user.id, parsed.data.username);
  }
}

function pageNumber(value?: string) {
  const p = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(value ?? 1);
  if (!p.success) throw new BadRequestException("Invalid page.");
  return p.data;
}
