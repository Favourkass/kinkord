import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { profile } from "../db/schema";
import { PresenceService } from "../presence/presence.service";
import { AUTH, Auth } from "./auth.instance";

/**
 * Accounts created from this moment must verify a phone before they can use
 * Kinkord. Older accounts are left alone; asking every existing member to
 * verify is a separate decision.
 */
export const PHONE_REQUIRED_SINCE = new Date("2026-09-28T00:00:00Z");

/** The `code` the web app recognises to send a member to the phone step. */
export const PHONE_VERIFICATION_REQUIRED = "PHONE_VERIFICATION_REQUIRED";

const ALLOW_UNVERIFIED_PHONE = "kinkord:allowUnverifiedPhone";

/** Marks the routes a member needs in order to verify their phone in the first place. */
export const AllowUnverifiedPhone = () => SetMetadata(ALLOW_UNVERIFIED_PHONE, true);

export interface AuthedRequest extends Request {
  user: NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>["user"];
  session: NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>["session"];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly presence: PresenceService,
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: Db,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const result = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!result) throw new UnauthorizedException("Not signed in");
    req.user = result.user;
    req.session = result.session;
    // Presence heartbeat: throttled and fire-and-forget, so it can never slow or fail a request.
    this.presence.touch(result.user.id);
    if (await this.mustVerifyPhone(ctx, result.user)) {
      throw new ForbiddenException({
        code: PHONE_VERIFICATION_REQUIRED,
        message: "Verify your phone number to continue.",
      });
    }
    return true;
  }

  /**
   * The code step can't be skipped in the app, but a member could still leave
   * the sign-up page and open any other one; this is what actually holds them
   * at the phone step. Only accounts old enough to predate the rule, and the
   * routes needed to verify, get through without a verified phone.
   */
  private async mustVerifyPhone(
    ctx: ExecutionContext,
    user: { id: string; createdAt: Date | string },
  ): Promise<boolean> {
    const created = new Date(user.createdAt);
    if (Number.isNaN(created.getTime()) || created < PHONE_REQUIRED_SINCE) return false;
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_PHONE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowed) return false;
    const [row] = await this.db
      .select({ verified: profile.phoneVerified })
      .from(profile)
      .where(eq(profile.userId, user.id))
      .limit(1);
    return !row?.verified;
  }
}
