import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Mirrors src/auth/auth.instance.ts options that affect schema shape.
export const auth = betterAuth({
  baseURL: "http://localhost:4000",
  basePath: "/api/auth",
  database: drizzleAdapter(drizzle(new Pool({})), { provider: "pg", schema: {} }),
  user: {
    additionalFields: {
      ageAttested: { type: "boolean", required: true, input: true },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    requireEmailVerification: true,
    sendResetPassword: async () => {},
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async () => {},
  },
  rateLimit: { enabled: true },
});
