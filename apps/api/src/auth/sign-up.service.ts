import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import { profile, user } from "../db/schema";
import { AUTH, Auth } from "./auth.instance";

export interface SignUpAccount {
  email: string;
  password: string;
  displayName: string;
  username: string;
}

export interface SignUpProfileFields {
  country: string | null;
  state: string | null;
  city: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
}

export interface SignUpResult {
  status: number;
  cookies: string[];
  body: string;
}

/**
 * Creates the account and its onboarding profile in one server-side step.
 *
 * The signup wizard now collects "account" and "about you" on a single screen,
 * so the backend must treat them as one unit. Better Auth owns account creation
 * (user + session + verification email); this service calls it, then writes the
 * about-fields onto the profile that Better Auth's create hook seeds. If that
 * profile write fails, the just-created account is rolled back so the user can
 * retry the combined step cleanly instead of hitting "email already exists".
 */
@Injectable()
export class SignUpService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  async signUpWithProfile(
    account: SignUpAccount,
    fields: SignUpProfileFields,
    headers: Headers,
  ): Promise<SignUpResult> {
    // Better Auth's signUpEmail is heavily overloaded (and carries plugin +
    // additional fields); assert the exact call shape we use so it types as a
    // Response instead of the object-return overload.
    const signUpEmail = this.auth.api.signUpEmail as unknown as (opts: {
      body: {
        email: string;
        password: string;
        name: string;
        username: string;
        ageAttested: boolean;
      };
      headers: Headers;
      asResponse: true;
    }) => Promise<Response>;
    const res = await signUpEmail({
      body: {
        email: account.email,
        password: account.password,
        name: account.displayName,
        username: account.username,
        ageAttested: true,
      },
      headers,
      asResponse: true,
    });

    const body = await res.text();
    const cookies = res.headers.getSetCookie();

    // Better Auth rejected it (email/username taken, weak password, …). Nothing
    // was created — forward its response so the client sees the real reason.
    if (!res.ok) return { status: res.status, cookies, body };

    const userId = this.extractUserId(body) ?? (await this.lookupUserId(account.email));
    if (!userId) {
      throw new InternalServerErrorException("Sign-up did not return an account.");
    }

    try {
      await this.db.update(profile).set(fields).where(eq(profile.userId, userId));
    } catch {
      // Roll the half-created account back (cascades to profile + session) so the
      // combined step can be retried instead of erroring "email already exists".
      await this.db.delete(user).where(eq(user.id, userId));
      throw new InternalServerErrorException("Could not complete sign-up. Please try again.");
    }

    return { status: res.status, cookies, body };
  }

  private extractUserId(body: string): string | undefined {
    try {
      return (JSON.parse(body) as { user?: { id?: string } }).user?.id;
    } catch {
      return undefined;
    }
  }

  private async lookupUserId(email: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    return row?.id;
  }
}
