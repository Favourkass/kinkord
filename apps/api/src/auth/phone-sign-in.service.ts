import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import { profile, user } from "../db/schema";
import { AUTH, Auth } from "./auth.instance";

export interface PhoneSignInInput {
  phone: string;
  password: string;
  rememberMe: boolean;
}

const INVALID = "Invalid phone number or password.";

/**
 * Signs a user in by the phone number on their profile. The phone is only a
 * lookup key — the password is still verified by Better Auth, so this leaks
 * nothing a normal failed sign-in wouldn't.
 */
@Injectable()
export class PhoneSignInService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  async signInWithPhone(input: PhoneSignInInput, headers: Headers): Promise<Response> {
    const rows = await this.db
      .select({ email: user.email })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .where(eq(profile.phone, input.phone))
      .limit(2);

    if (rows.length !== 1) throw new UnauthorizedException(INVALID);

    return this.auth.api.signInEmail({
      body: { email: rows[0].email, password: input.password, rememberMe: input.rememberMe },
      headers,
      asResponse: true,
    });
  }
}
