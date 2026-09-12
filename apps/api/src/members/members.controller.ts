import { BadRequestException, Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { MembersService } from "./members.service";

const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "country must be ISO 3166-1 alpha-2");

const statesQuerySchema = z.object({ country: countryCode });

const listQuerySchema = z
  .object({
    country: countryCode,
    /** Optional: without it the whole country is listed. */
    state: z.string().trim().min(1).max(80).optional(),
    lga: z.string().trim().min(1).max(80).optional(),
    sort: z.enum(["recent", "followers", "name"]).default("recent"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((q) => !q.lga || Boolean(q.state), { message: "lga requires state", path: ["lga"] });

@Controller("members")
@UseGuards(AuthGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get("countries")
  countries() {
    return this.members.countries();
  }

  @Get("states")
  states(@Query() query: unknown) {
    const parsed = statesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.members.states(parsed.data.country);
  }

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.members.list(parsed.data, req.user.id);
  }
}
