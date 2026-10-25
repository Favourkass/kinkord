import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import { profile, user } from "../db/schema";
import { clientIpFrom } from "../moderation/signup-rules";
import { AUTH, Auth } from "./auth.instance";
import {
  networkKey,
  recordSignInFailure,
  signInBlocked,
  TOO_MANY_ATTEMPTS,
} from "./sign-in-limits";

export interface PhoneSignInInput {
  phone: string;
  password: string;
  rememberMe: boolean;
}

const INVALID = "Invalid phone number or password.";

/**
 * Signs a user in by the verified phone number on their profile. The phone is
 * only a lookup key — the password is still verified by Better Auth, so this
 * leaks nothing a normal failed sign-in wouldn't.
 *
 * Only a verified number counts: anyone can type someone else's number into
 * their profile, and an unverified copy must neither sign in nor make the
 * owner's own sign-in ambiguous.
 */
@Injectable()
export class PhoneSignInService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  async signInWithPhone(input: PhoneSignInInput, headers: Headers): Promise<Response> {
    // Numbers that match no account count against the network too, so they can't
    // be tried endlessly; a matching one is limited per account by the auth hooks.
    const network = { account: null, network: networkKey(clientIpFrom(headers)) };
    if (await signInBlocked(this.db, network)) {
      throw new HttpException(TOO_MANY_ATTEMPTS, HttpStatus.TOO_MANY_REQUESTS);
    }
    const rows = await this.db
      .select({ email: user.email })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .where(and(eq(profile.phone, input.phone), eq(profile.phoneVerified, true)))
      .limit(2);

    if (rows.length !== 1) {
      await recordSignInFailure(this.db, network);
      throw new UnauthorizedException(INVALID);
    }

    return this.auth.api.signInEmail({
      body: { email: rows[0].email, password: input.password, rememberMe: input.rememberMe },
      headers,
      asResponse: true,
    });
  }
}
