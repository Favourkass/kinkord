import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
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
      },
    }),
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
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        const t = resetPasswordEmail(url);
        await email.send({ to: user.email, ...t });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const t = verificationEmail(url);
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
