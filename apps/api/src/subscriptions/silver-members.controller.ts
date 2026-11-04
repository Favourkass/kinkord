import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { SilverMembersService } from "./silver-members.service";
import { parse } from "./subscriptions.controller";

const listSchema = z.object({
  source: z.enum(["all", "subscription", "ring", "given"]).default("all"),
  q: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

/** Everyone on Silver now, and whether they paid, got a Kink Ring, or were given it. */
@Controller("admin/silver-members")
@UseGuards(AuthGuard, AdminGuard)
export class SilverMembersController {
  constructor(private readonly silver: SilverMembersService) {}

  @Get()
  list(@Query() query: unknown) {
    const { source, q, page } = parse(listSchema, query);
    return this.silver.list(source, q || undefined, page);
  }
}
