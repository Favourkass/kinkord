import { createAuthClient } from "better-auth/react";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const authApiBase = apiBase.startsWith("/")
  ? `${typeof window === "undefined" ? "http://localhost:3000" : window.location.origin}${apiBase}`
  : apiBase;

/**
 * Better Auth browser client. Cookies ride on every call (cross-subdomain in
 * production: kinkord.com -> api.kinkord.com).
 */
export const authClient = createAuthClient({
  baseURL: `${authApiBase}/api/auth`,
  plugins: [usernameClient(), twoFactorClient()],
  fetchOptions: { credentials: "include" },
});
