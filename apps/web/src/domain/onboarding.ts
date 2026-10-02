/** Pure signup-wizard logic: validation and normalization, no React. */

export const WIZARD_STEPS = 5;

export interface AccountDraft {
  username: string;
  displayName: string;
  email: string;
  phoneLocal: string;
  phoneCountryCode: string;
  password: string;
  confirmPassword: string;
}

export interface AboutDraft {
  state: string;
  city: string;
  dobDay: number | null;
  dobMonth: number | null;
  dobYear: number | null;
  gender: "male" | "female" | null;
}

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export function validateAccount(d: AccountDraft): Partial<Record<keyof AccountDraft, string>> {
  const errors: Partial<Record<keyof AccountDraft, string>> = {};
  const username = d.username.replace(/^@/, "").toLowerCase();
  if (!USERNAME_RE.test(username))
    errors.username = "3–30 characters: letters, numbers, underscores.";
  if (d.displayName.trim().length < 3 || d.displayName.trim().length > 30)
    errors.displayName = "Display name must be 3–30 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()))
    errors.email = "Enter a valid email address.";
  // Required: a number is what stops a removed member coming back with a fresh email.
  if (!d.phoneLocal.trim()) errors.phoneLocal = "Enter your phone number.";
  else if (!isAllowedPhone(toE164(d.phoneCountryCode, d.phoneLocal)))
    errors.phoneLocal = PHONE_NIGERIA_ONLY;
  if (d.password.length < 10) errors.password = "Use at least 10 characters.";
  else if (!/[a-zA-Z]/.test(d.password) || !/\d/.test(d.password))
    errors.password = "Use letters and numbers.";
  if (d.confirmPassword !== d.password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

/**
 * Which numbers can sign up: Nigerian mobiles only, for now (2026-10-02). The
 * API holds the same rule (apps/api/src/profiles/phone-rules.ts); open another
 * country in both, and in PHONE_COUNTRY_CODES. A Nigerian mobile is +234 then
 * ten digits starting 70, 71, 80, 81, 90 or 91 (0803…, 0703…, 0913…).
 */
const ALLOWED_MOBILE_NUMBERS: readonly RegExp[] = [/^\+234[789][01]\d{8}$/];

export const PHONE_NIGERIA_ONLY = "Enter a Nigerian mobile number, like 0803 123 4567.";

export function isAllowedPhone(e164: string | null): boolean {
  return e164 !== null && ALLOWED_MOBILE_NUMBERS.some((pattern) => pattern.test(e164));
}

/**
 * "+234" + "0803 123 4567" -> "+2348031234567"; returns null when invalid.
 *
 * Autofill and copy-paste often put the whole international number in the
 * local box ("+234 803…", "00234 803…", "234803…"), so a leading country code
 * is recognised rather than doubled. A "+" number for another country is kept
 * as typed.
 */
export function toE164(countryCode: string, local: string): string | null {
  const cc = countryCode.replace(/\D/g, "");
  if (!cc) return null;
  const typed = local.trim();
  let digits = typed.replace(/\D/g, "");
  const international = typed.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (international && !digits.startsWith(cc)) {
    return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
  }
  // Without a "+", only drop digits that match the code when a full national
  // number is left after them: shorter numbers can legitimately start that way.
  if (digits.startsWith(cc) && (international || digits.length - cc.length >= 9)) {
    digits = digits.slice(cc.length);
  }
  digits = digits.replace(/^0+/, "");
  if (digits.length < 7 || digits.length > 12) return null;
  const full = `+${cc}${digits}`;
  return /^\+\d{8,15}$/.test(full) ? full : null;
}

export function dobToIso(a: AboutDraft): string | null {
  if (!a.dobDay || a.dobMonth === null || a.dobMonth === undefined || !a.dobYear) return null;
  if (a.dobMonth < 1 || a.dobMonth > 12) return null;
  const d = new Date(Date.UTC(a.dobYear, a.dobMonth - 1, a.dobDay));
  if (
    d.getUTCFullYear() !== a.dobYear ||
    d.getUTCMonth() !== a.dobMonth - 1 ||
    d.getUTCDate() !== a.dobDay
  )
    return null;
  return d.toISOString().slice(0, 10);
}

export function isAdult(iso: string, now = new Date()): boolean {
  const dob = new Date(iso);
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob <= cutoff;
}

export function validateAbout(a: AboutDraft): { dob?: string; state?: string; gender?: string } {
  const errors: { dob?: string; state?: string; gender?: string } = {};
  const iso = dobToIso(a);
  if (!iso) errors.dob = "Select your full date of birth.";
  else if (!isAdult(iso)) errors.dob = "You must be 18 years or older to join.";
  if (!a.state.trim()) errors.state = "Select your state.";
  if (!a.gender) errors.gender = "Select an option.";
  return errors;
}

/** Every field the combined account + about screen checks, top to bottom. */
export const SIGNUP_FIELDS = [
  "username",
  "displayName",
  "email",
  "phoneLocal",
  "password",
  "confirmPassword",
  "state",
  "dob",
  "gender",
] as const;
export type SignupField = (typeof SIGNUP_FIELDS)[number];

/** The fields with an error, in the order they appear on screen. */
export function invalidSignupFields(
  ...errorSets: Partial<Record<string, string>>[]
): SignupField[] {
  return SIGNUP_FIELDS.filter((f) => errorSets.some((errors) => errors[f]));
}
