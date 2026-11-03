import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { isSuperAdmin } from "../moderation/admins";
import { LocationCheckService } from "./location-check.service";
import { LOCATION_CHECK_MODES, LocationSettingsService } from "./location-settings.service";

const DECISIONS = [
  "approved",
  "travel",
  "mismatch",
  "retry",
  "refused",
  "paused",
  "skipped",
] as const;

const listSchema = z.object({
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  decision: z.enum(DECISIONS).optional(),
});

const daysSchema = z.coerce.number().int().min(1).max(90).default(7);

const modeSchema = z.object({ mode: z.enum(LOCATION_CHECK_MODES) });

function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

/** Moderation → Location: how the country check is going, and the founders' switch. */
@Controller("admin/location-checks")
@UseGuards(AuthGuard, AdminGuard)
export class LocationAdminController {
  constructor(
    private readonly checks: LocationCheckService,
    private readonly settings: LocationSettingsService,
  ) {}

  @Get("summary")
  summary(@Query("days") days: unknown) {
    return this.checks.summary(parse(daysSchema, days));
  }

  @Get()
  list(@Query() query: unknown) {
    const { before, limit, decision } = parse(listSchema, query);
    return this.checks.list({
      before: before ? new Date(before) : null,
      limit,
      decision: decision ?? null,
    });
  }

  /** Off, watch or enforce: the founders' call alone. */
  @Put("mode")
  async setMode(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!isSuperAdmin(req.user)) {
      throw new ForbiddenException("Only the founders can switch the country check.");
    }
    const { mode } = parse(modeSchema, body);
    return { mode: await this.settings.setMode(mode, req.user.id) };
  }
}
