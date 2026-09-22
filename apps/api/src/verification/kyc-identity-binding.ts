import { createHmac, timingSafeEqual } from "node:crypto";

function normalized(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizedGender(value: string) {
  const gender = normalized(value);
  return gender.startsWith("m") ? "m" : gender.startsWith("f") ? "f" : gender;
}

/**
 * Produces a one-way binding between the verified-ID identity and a later
 * financial-provider identity. Raw legal names are never stored by Kinkord.
 */
export function kycIdentityBinding(input: { fullName: string; dateOfBirth: string; gender: string }, secret = process.env.KYC_IDENTITY_BINDING_SECRET ?? process.env.AUTH_SECRET) {
  const fullName = normalized(input.fullName);
  const dateOfBirth = input.dateOfBirth.trim().slice(0, 10);
  const gender = normalizedGender(input.gender);
  if (!fullName || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !gender) return null;
  if (!secret || secret.length < 32) throw new Error("KYC identity binding secret is not configured.");
  return createHmac("sha256", secret).update(`${fullName}\u0000${dateOfBirth}\u0000${gender}`).digest("base64url");
}

export function identityBindingsMatch(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
