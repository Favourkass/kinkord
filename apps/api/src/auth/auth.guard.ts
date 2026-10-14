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
import { isSuperAdmin } from "../moderation/admins";
import { PresenceService } from "../presence/presence.service";
import { AUTH, Auth } from "./auth.instance";

/**
 * Accounts created from this moment must verify their email before they can
 * use Kinkord: with the phone optional, the verified address is what a ban
 * holds on to. Older accounts are left alone; asking every existing member to
 * verify is a separate decision.
 */
export const EMAIL_VERIFICATION_REQUIRED_FROM = new Date("2026-10-14T00:00:00Z");

/** The `code` the web app recognises to send a member to the email step. */
export const EMAIL_VERIFICATION_REQUIRED = "EMAIL_VERIFICATION_REQUIRED";

/** The `code` the web app recognises to send a member to the profile-photo step. */
export const PROFILE_PHOTOS_REQUIRED = "PROFILE_PHOTOS_REQUIRED";

const ALLOW_DURING_SIGN_UP = "kinkord:allowDuringSignUp";

/**
 * Marks the routes a member needs to finish sign-up (verify their email, add
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

interface SignedInUser {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date | string;
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
   * The sign-up steps can't be skipped in the app, but a member could still
   * leave the sign-up page and open any other one; this is what actually holds
   * them at the step they still owe, in sign-up order. Only the routes needed
   * to finish sign-up get through.
   *
   * - Email: accounts created since EMAIL_VERIFICATION_REQUIRED_FROM need a
   *   verified email. Founders are never held.
   * - Photos: members need a profile photo and a cover picture, the last step
   *   of sign-up. They may skip both only at first sign-up, before they have
   *   ever had a profile photo. A skipped cover stays optional, but once they
   *   have had a photo, deleting it from the Media tab asks for a new one, as
   *   it does for everyone who never skipped.
   */
  private async signUpHold(ctx: ExecutionContext, user: SignedInUser): Promise<SignUpHold | null> {
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_SIGN_UP, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowed) return null;
    if (needsEmailVerification(user)) {
      return {
        code: EMAIL_VERIFICATION_REQUIRED,
        message: "Verify your email address to continue.",
      };
    }
    const [row] = await this.db
      .select({
        avatarKey: profile.avatarKey,
        coverKey: profile.coverKey,
        signupPhotosSkipped: profile.signupPhotosSkipped,
        photoSkipAvailable: profile.photoSkipAvailable,
      })
      .from(profile)
      .where(eq(profile.userId, user.id))
      .limit(1);
    // Without a profile row there is nowhere to save photos, so holding the
    // member would only lock them out.
    if (row && photosMissing(row)) {
      return {
        code: PROFILE_PHOTOS_REQUIRED,
        message: "Add a profile photo and a cover picture to continue.",
      };
    }
    return null;
  }
}

/** Whether the member still owes a photo, given what they skipped and when. */
function photosMissing(row: {
  avatarKey: string | null;
  coverKey: string | null;
  signupPhotosSkipped: boolean;
  photoSkipAvailable: boolean;
}): boolean {
  const avatarSkipped = row.signupPhotosSkipped && row.photoSkipAvailable;
  return (!row.avatarKey && !avatarSkipped) || (!row.coverKey && !row.signupPhotosSkipped);
}

/** Whether this member still owes the email step before Kinkord opens up. */
export function needsEmailVerification(user: Omit<SignedInUser, "id">): boolean {
  if (user.emailVerified || isSuperAdmin(user)) return false;
  const created = new Date(user.createdAt);
  return !Number.isNaN(created.getTime()) && created >= EMAIL_VERIFICATION_REQUIRED_FROM;
}
