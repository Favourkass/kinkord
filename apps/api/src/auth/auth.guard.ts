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
import { PHONE_STEP_REQUIRED } from "../profiles/phone-rules";
import { AUTH, Auth } from "./auth.instance";

/**
 * Accounts created from this moment must verify a phone before they can use
 * Kinkord, while PHONE_STEP_REQUIRED is on. Older accounts are left alone;
 * asking every existing member to verify is a separate decision.
 */
export const PHONE_REQUIRED_SINCE = new Date("2026-09-28T00:00:00Z");

/** The `code` the web app recognises to send a member to the phone step. */
export const PHONE_VERIFICATION_REQUIRED = "PHONE_VERIFICATION_REQUIRED";

/** The `code` the web app recognises to send a member to the profile-photo step. */
export const PROFILE_PHOTOS_REQUIRED = "PROFILE_PHOTOS_REQUIRED";

const ALLOW_DURING_SIGN_UP = "kinkord:allowDuringSignUp";

/**
 * Marks the routes a member needs to finish sign-up (verify a phone, add
 * profile photos), so the sign-up holds below let them through.
 */
export const AllowDuringSignUp = () => SetMetadata(ALLOW_DURING_SIGN_UP, true);

export interface AuthedRequest extends Request {
  user: NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>["user"];
  session: NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>["session"];
}

interface SignUpHold {
  code: string;
  message: string;
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
    const hold = await this.signUpHold(ctx, result.user);
    if (hold) throw new ForbiddenException(hold);
    return true;
  }

  /**
   * The sign-up steps can't be skipped in the app (bar the phone code, for
   * now), but a member could still leave the sign-up page and open any other
   * one; this is what actually holds them at the step they still owe. Only the
   * routes needed to finish sign-up get through.
   *
   * - Phone: while PHONE_STEP_REQUIRED is on, accounts newer than the rule
   *   need a verified phone.
   * - Photos: every member needs a profile photo and a cover picture, the
   *   last step of sign-up. Deleting the current one from the Media tab asks
   *   for a new one the same way.
   */
  private async signUpHold(
    ctx: ExecutionContext,
    user: { id: string; createdAt: Date | string },
  ): Promise<SignUpHold | null> {
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_SIGN_UP, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowed) return null;
    const [row] = await this.db
      .select({
        phoneVerified: profile.phoneVerified,
        avatarKey: profile.avatarKey,
        coverKey: profile.coverKey,
      })
      .from(profile)
      .where(eq(profile.userId, user.id))
      .limit(1);
    if (PHONE_STEP_REQUIRED && createdSincePhoneRule(user.createdAt) && !row?.phoneVerified) {
      return {
        code: PHONE_VERIFICATION_REQUIRED,
        message: "Verify your phone number to continue.",
      };
    }
    // Without a profile row there is nowhere to save photos, so holding the
    // member would only lock them out.
    if (row && (!row.avatarKey || !row.coverKey)) {
      return {
        code: PROFILE_PHOTOS_REQUIRED,
        message: "Add a profile photo and a cover picture to continue.",
      };
    }
    return null;
  }
}

function createdSincePhoneRule(createdAt: Date | string): boolean {
  const created = new Date(createdAt);
  return !Number.isNaN(created.getTime()) && created >= PHONE_REQUIRED_SINCE;
}
