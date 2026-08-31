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
  if (d.phoneLocal.trim() && !toE164(d.phoneCountryCode, d.phoneLocal))
    errors.phoneLocal = "Enter a valid phone number.";
  if (d.password.length < 8) errors.password = "Use at least 8 characters.";
  else if (!/[a-zA-Z]/.test(d.password) || !/\d/.test(d.password))
    errors.password = "Use letters and numbers.";
  if (d.confirmPassword !== d.password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

/** "+234" + "0803 123 4567" -> "+2348031234567"; returns null when invalid. */
export function toE164(countryCode: string, local: string): string | null {
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  const cc = countryCode.replace(/\D/g, "");
  if (!cc || digits.length < 7 || digits.length > 12) return null;
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
