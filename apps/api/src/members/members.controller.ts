import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { SHOW_OPTIONS } from "./matching";
import { MembersService } from "./members.service";

const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "country must be ISO 3166-1 alpha-2");

const statesQuerySchema = z.object({ country: countryCode });

const searchQuerySchema = z.object({
  /** A name or @username: at least one character once the @ is gone. */
  q: z
    .string()
    .trim()
    .max(50)
    .transform((v) => v.replace(/^@+/, "").trim())
    .pipe(z.string().min(1)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const suggestedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  /** Women, men or everyone; without it, the member's own default (see matching.ts). */
  show: z.enum(SHOW_OPTIONS).optional(),
});

const memberIdSchema = z.string().trim().min(1).max(64);

const listQuerySchema = z
  .object({
    country: countryCode,
    /** Optional: without it the whole country is listed. */
    state: z.string().trim().min(1).max(80).optional(),
    lga: z.string().trim().min(1).max(80).optional(),
    /** A name or @username to look for. */
    q: z
      .string()
      .trim()
      .max(50)
      .transform((v) => v.replace(/^@+/, "").trim() || undefined)
      .optional(),
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

  /**
   * Every organization's account: few, and public, so the app can show them as
   * organizations wherever their names appear.
   */
  @Get("organizations")
  organizations() {
    return this.members.organizations();
  }

  @Get("states")
  states(@Query() query: unknown) {
    const parsed = statesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.members.states(parsed.data.country);
  }

  /** The app's search: people by name or username, across every country. */
  @Get("search")
  search(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    const { q, page, limit } = parsed.data;
    return this.members.search(req.user.id, q, page, limit);
  }

  /** Home feed "Kinksters Near You", ranked by matching v1. */
  @Get("suggested")
  suggested(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = suggestedQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.members.suggestedForFeed(req.user.id, parsed.data.limit, parsed.data.show);
  }

  /** Remove on a card: never suggest this member to the viewer again. */
  @Post("suggested/:userId/dismiss")
  dismissSuggestion(@Req() req: AuthedRequest, @Param("userId") userId: string) {
    const parsed = memberIdSchema.safeParse(userId);
    if (!parsed.success) throw new BadRequestException("invalid member");
    return this.members.dismissSuggestion(req.user.id, parsed.data);
  }

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.members.list(parsed.data, req.user.id);
  }
}
