import { BadRequestException, Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { z } from "zod";
import { AUTH, type Auth } from "../auth/auth.instance";
import { checkedIp } from "./client-ip";
import { LocationCheckService, type CheckingMember } from "./location-check.service";

const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "country must be ISO 3166-1 alpha-2");

const deviceIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]{8,64}$/)
  .nullable();

const checkSchema = z.object({
  country: countrySchema,
  gps: z.discriminatedUnion("status", [
    z.object({ status: z.literal("ok"), lat: z.number(), lng: z.number(), accuracy: z.number() }),
    z.object({ status: z.enum(["denied", "unavailable", "timeout", "unsupported"]) }),
  ]),
  device: z.object({
    timezone: z.string().trim().max(64).nullable(),
    automation: z.boolean(),
    geolocationNative: z.boolean(),
    renderer: z.string().max(200).nullable(),
  }),
  deviceId: deviceIdSchema,
});

const skipSchema = z.object({ country: countrySchema, deviceId: deviceIdSchema });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

/**
 * Open to visitors, because joining needs a check before the account exists,
 * and to members, who are held at it. So it reads the session itself instead
 * of using the auth guard, which would hold them away from the very check
 * they owe.
 */
@Controller("location-check")
export class LocationCheckController {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly checks: LocationCheckService,
  ) {}

  /** Whether the app should run checks, and whether they apply yet. */
  @Get("mode")
  async mode() {
    return { mode: await this.checks.mode() };
  }

  @Post()
  async check(@Req() req: Request, @Body() body: unknown) {
    const input = parse(checkSchema, body);
    const headers = fromNodeHeaders(req.headers);
    return this.checks.check({
      ...input,
      member: await this.memberOf(headers),
      ip: checkedIp(headers),
    });
  }

  /** Watch mode only: "Not now". */
  @Post("skip")
  async skip(@Req() req: Request, @Body() body: unknown) {
    const input = parse(skipSchema, body);
    const headers = fromNodeHeaders(req.headers);
    return this.checks.skip({
      ...input,
      member: await this.memberOf(headers),
      ip: checkedIp(headers),
    });
  }

  private async memberOf(headers: Headers): Promise<CheckingMember | null> {
    const session = await this.auth.api.getSession({ headers });
    return session ? this.checks.memberOf(session.user.id) : null;
  }
}
