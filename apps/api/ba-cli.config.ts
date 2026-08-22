import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, twoFactor, username } from "better-auth/plugins";
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
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    twoFactor({ issuer: "Kinkord" }),
    emailOTP({ otpLength: 6, expiresIn: 600, async sendVerificationOTP() {} }),
  ],
  emailAndPassword: { enabled: true, minPasswordLength: 10, requireEmailVerification: true },
});
