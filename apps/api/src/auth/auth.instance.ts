import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { twoFactor, username } from "better-auth/plugins";
import { Db } from "../db/db.module";
import * as schema from "../db/schema";
import { EmailService } from "../email/email.service";
import { resetPasswordEmail, verificationEmail } from "../email/templates";
import { SIGNUP_REFUSED, SignupGuardService } from "../moderation/signup-guard.service";
import { clientIpFrom } from "../moderation/signup-rules";
import { ACCOUNT_SUSPENDED, isBanned } from "../moderation/admins";
import { NAME_RESERVED, takesReservedName } from "../profiles/reserved-names";
import { countPasswordSignIn, guardPasswordSignIn } from "./sign-in-limits";

export const AUTH = Symbol("AUTH");
export type Auth = ReturnType<typeof buildAuth>;

/**
 * Username changes go through PATCH /profile/username, which enforces the 30-day lock
 * (CEO brief, 2026-09-12). Better Auth's generic update-user route must not be a way
 * around it, so any username field in an update is refused here.
 */
export function rejectUsernameChanges<T extends object>(data: T): { data: T } {
  if ("username" in data || "displayUsername" in data) {
    throw new APIError("BAD_REQUEST", { message: "Change your username from Edit Profile." });
  }
  return { data };
}

/**
 * "Kinkord" is reserved (profiles/reserved-names.ts). Every sign-up route creates its
 * user through the create hook, so a new account's name and username are checked
 * there, with nothing current. The update-user route can still rename the account
 * (`name`), so a new name is checked against the one it has now.
 */
export function rejectReservedNames(
  data: { name?: unknown; username?: unknown; displayUsername?: unknown },
  currentName: string | null = null,
): void {
  const name = typeof data.name === "string" && takesReservedName(data.name, currentName);
  const handle = [data.username, data.displayUsername].some(
    (value) => typeof value === "string" && takesReservedName(value),
  );
  if (name || handle) throw new APIError("BAD_REQUEST", { message: NAME_RESERVED });
}

export function buildAuth(db: Db, email: EmailService, signupGuard: SignupGuardService) {
  const webOrigins = (process.env.WEB_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return betterAuth({
    baseURL: process.env.AUTH_BASE_URL ?? "http://localhost:4000",
    basePath: "/api/auth",
    secret: process.env.AUTH_SECRET,
    trustedOrigins: webOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
      },
    }),
    plugins: [
      // Unique handle (@username) on the account; sign-in works with it too.
      username({ minUsernameLength: 3, maxUsernameLength: 30 }),
      // TOTP 2FA: works with Google Authenticator/Authy/any authenticator app.
      twoFactor({ issuer: "Kinkord" }),
    ],
    user: {
      additionalFields: {
        ageAttested: { type: "boolean", required: true, input: true },
      },
    },
    hooks: {
      // Wrong-password limits on every password sign-in. Phone sign-in calls
      // /sign-in/email in-process, which Better Auth's own rate limit never sees.
      before: createAuthMiddleware((ctx) => guardPasswordSignIn(db, ctx)),
      after: createAuthMiddleware((ctx) => countPasswordSignIn(db, ctx)),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u, ctx) => {
            // Age gate v0 (18+ platform): refuse accounts without attestation.
            if (!(u as { ageAttested?: boolean }).ageAttested) {
              throw new APIError("BAD_REQUEST", {
                message: "You must confirm you are 18 or older to create an account.",
              });
            }
            rejectReservedNames(u);
            // Removed members stay removed. Every sign-up route creates the user
            // here, so this is the one place email, name and IP are all checked.
            const verdict = await signupGuard.review(
              {
                email: u.email,
                name: u.name,
                ip: clientIpFrom(ctx?.headers ?? ctx?.request?.headers),
              },
              "sign-up",
            );
            if (verdict.action === "block") {
              throw new APIError("FORBIDDEN", { message: SIGNUP_REFUSED });
            }
            return { data: u };
          },
          after: async (u) => {
            // Public persona starts as the signup name; user customizes later.
            await db
              .insert(schema.profile)
              .values({ userId: u.id, displayName: u.name })
              .onConflictDoNothing();
          },
        },
        update: {
          before: async (u, ctx) => {
            const update = rejectUsernameChanges(u);
            rejectReservedNames(u, ctx?.context.session?.user.name ?? null);
            return update;
          },
        },
      },
      session: {
        create: {
          // A suspended member can't start a session by any route: email,
          // phone or a password reset. Their existing sessions were deleted
          // when the ban was made.
          before: async (s) => {
            if (await isBanned(db, s.userId)) {
              throw new APIError("FORBIDDEN", { message: ACCOUNT_SUSPENDED });
            }
            return { data: s };
          },
        },
      },
    },
    session: {
      // Long, sliding session so people stay signed in like a native app.
      // The cookie lives 30 days and is refreshed on activity (updateAge), so
      // active users are effectively never logged out; only true inactivity for
      // 30 days ends the session. Persistence itself is gated by `rememberMe`
      // at sign-in (defaulted on for the web client).
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh the window once per day of activity
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      // Signup opens a session immediately so the onboarding wizard can finish
      // (steps 3-5 need auth). The step-3 email code is enforced by AuthGuard's
      // sign-up hold instead (accounts since 2026-10-14): only the routes the
      // wizard needs answer until it's done. The phone is optional and only
      // gates "Basic verified".
      requireEmailVerification: false,
      // A reset is how members take back an account someone else got into, so
      // it signs out every device rather than leaving the intruder in.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const t = resetPasswordEmail(url);
        await email.send({ to: user.email, ...t });
      },
    },
    emailVerification: {
      // The address is verified with a 6-digit code through POST
      // /profile/email/send-code (Favour, 2026-09-15) rather than a link, so
      // Better Auth must not also mail one. sendVerificationEmail stays wired
      // for links already sitting in inboxes and for any manual resend.
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        // Land the click on the web app's confirmation page, signed in.
        const link = new URL(url);
        link.searchParams.set("callbackURL", `${webOrigins[0]}/verify-email`);
        const t = verificationEmail(link.toString());
        await email.send({ to: user.email, ...t });
      },
    },
    advanced: {
      ...(process.env.COOKIE_DOMAIN
        ? {
            crossSubDomainCookies: { enabled: true, domain: process.env.COOKIE_DOMAIN },
          }
        : {}),
    },
    rateLimit: { enabled: true },
  });
}
