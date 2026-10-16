import { createHmac } from "node:crypto";

/** Lower-case words with accents dropped, so "Ọkafor", "OKAFOR" and "okafor" agree. */
function words(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function normalizedGender(value: string) {
  const gender = words(value).join(" ");
  return gender.startsWith("m") ? "m" : gender.startsWith("f") ? "f" : gender;
}

/**
 * A keyed one-way fingerprint of a verified legal name, birth date and gender,
 * so a second account verified by the same person can be spotted without
 * Kinkord ever storing the name. The name's words are sorted, because
 * documents order them differently ("OKAFOR ADA" on one, "Ada Okafor" on
 * another). Null when the ID gave too little to go on.
 *
 * Changing how this is computed breaks every stored fingerprint, so it must
 * stay as it is once verification is switched on.
 */
export function identityBinding(
  input: { fullName: string; dateOfBirth: string; gender: string },
  secret: string,
): string | null {
  const fullName = words(input.fullName).sort().join(" ");
  const dateOfBirth = input.dateOfBirth.trim().slice(0, 10);
  const gender = normalizedGender(input.gender);
  if (!fullName || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !gender) return null;
  if (secret.length < 32) throw new Error("Identity binding secret is not configured.");
  return createHmac("sha256", secret)
    .update(`${fullName}\u0000${dateOfBirth}\u0000${gender}`)
    .digest("base64url");
}
