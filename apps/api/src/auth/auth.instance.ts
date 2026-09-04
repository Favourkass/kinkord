import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { twoFactor, username } from "better-auth/plugins";
import { Db } from "../db/db.module";
import * as schema from "../db/schema";
import { EmailService } from "../email/email.service";
import { resetPasswordEmail, verificationEmail } from "../email/templates";

export const AUTH = Symbol("AUTH");
export type Auth = ReturnType<typeof buildAuth>;

export function buildAuth(db: Db, email: EmailService) {
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
    databaseHooks: {
      user: {
        create: {
          before: async (u) => {
            // Age gate v0 (18+ platform): refuse accounts without attestation.
            if (!(u as { ageAttested?: boolean }).ageAttested) {
              throw new APIError("BAD_REQUEST", {
                message: "You must confirm you are 18 or older to create an account.",
              });
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
      // (steps 4-5 need auth). Email link verification runs alongside; the
      // step-3 phone OTP is skippable until SMS is live (user decision
      // 2026-08-22) and gates "Basic verified", not login.
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        const t = resetPasswordEmail(url);
        await email.send({ to: user.email, ...t });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
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
