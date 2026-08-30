export type IdentifierKind = "email" | "username" | "phone";

export interface ClassifiedIdentifier {
  kind: IdentifierKind;
  value: string;
}

const PHONE_SHAPE = /^\+?[\d\s()-]{7,}$/;

/**
 * Decides which sign-in flow an identifier belongs to and normalizes it.
 * - Contains "@" beyond position 0 → email.
 * - Digit-shaped with 10+ digits (optionally +, spaces, dashes) → phone,
 *   normalized to E.164 (a leading 0 is treated as Nigerian local format).
 * - Anything else → username (leading @ stripped, lowercased); short
 *   digit-only strings stay usernames since handles may be numeric.
 */
export function classifyIdentifier(raw: string): ClassifiedIdentifier {
  const trimmed = raw.trim();
  if (trimmed.includes("@") && !trimmed.startsWith("@")) {
    return { kind: "email", value: trimmed };
  }
  if (PHONE_SHAPE.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 10) {
      if (trimmed.startsWith("+")) return { kind: "phone", value: `+${digits}` };
      if (digits.startsWith("0")) return { kind: "phone", value: `+234${digits.slice(1)}` };
      return { kind: "phone", value: `+${digits}` };
    }
  }
  return { kind: "username", value: trimmed.replace(/^@/, "").toLowerCase() };
}
