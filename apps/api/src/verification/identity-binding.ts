import { createHmac } from "node:crypto";

function normalized(value: string) {
  return value
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizedGender(value: string) {
  const gender = normalized(value);
  return gender.startsWith("m") ? "m" : gender.startsWith("f") ? "f" : gender;
}

/**
 * A keyed one-way fingerprint of a verified legal name, birth date and gender,
 * so a second account verified by the same person can be spotted without
 * Kinkord ever storing the name. Null when the ID gave too little to go on.
 */
export function identityBinding(
  input: { fullName: string; dateOfBirth: string; gender: string },
  secret: string,
): string | null {
  const fullName = normalized(input.fullName);
  const dateOfBirth = input.dateOfBirth.trim().slice(0, 10);
  const gender = normalizedGender(input.gender);
  if (!fullName || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !gender) return null;
  if (secret.length < 32) throw new Error("Identity binding secret is not configured.");
  return createHmac("sha256", secret)
    .update(`${fullName}\u0000${dateOfBirth}\u0000${gender}`)
    .digest("base64url");
}
