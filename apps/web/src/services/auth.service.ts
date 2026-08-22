import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "kinkord-admin";

const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? "fallback-dev-secret-change-me");

export function checkAdminCredentials(username: string, password: string): boolean {
  return username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
}

export async function signToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}
