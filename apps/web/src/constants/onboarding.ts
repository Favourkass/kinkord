import type { SignupField } from "@/domain/onboarding";

export const LAUNCH_COUNTRIES = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "+234" },
] as const;

/**
 * Nigerian numbers only, for now (2026-10-02): texts abroad cost more and
 * arrived less reliably. To reopen a country, add its dial code here, e.g.
 * { code: "GH", dialCode: "+233", flag: "🇬🇭" }, and its mobile pattern in
 * domain/onboarding.ts and apps/api/src/profiles/phone-rules.ts.
 */
export const PHONE_COUNTRY_CODES = [{ code: "NG", dialCode: "+234", flag: "🇳🇬" }] as const;

export const NG_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT Abuja",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

/** Signup step 4 chips — the CEO's role list (2026-09-12); Edit Profile offers the same 20 via the API. */
export const KINK_ROLES = [
  "Ageplayer",
  "Bottom",
  "Brat",
  "Caregiver",
  "Cuckold",
  "Dominant",
  "Domme",
  "Exhibitionist",
  "Masochist",
  "Master",
  "Mistress",
  "Owner",
  "Pet",
  "Primal",
  "Sadist",
  "Slave",
  "Submissive",
  "Switch",
  "Top",
  "Voyeur",
] as const;

export const SIGNUP_STEP_LABELS = [
  "Country",
  "Account",
  "Verification",
  "Profile",
  "Welcome",
] as const;

/** How the Send OTP message names each field that needs fixing. */
export const SIGNUP_FIELD_NAMES: Record<SignupField, string> = {
  username: "username",
  displayName: "display name",
  email: "email address",
  phoneLocal: "phone number",
  password: "password",
  confirmPassword: "password confirmation",
  state: "state",
  dob: "date of birth",
  gender: "gender",
};

/**
 * Shown by the Send OTP button when a field above it fails: on a phone the
 * field itself is usually scrolled out of view, so the tap has to say why
 * nothing happened.
 */
export function signupFixFieldsMessage(fields: SignupField[]): string {
  if (fields.length > 3) return "Fill in the fields marked in red above.";
  const names = fields.map((f) => SIGNUP_FIELD_NAMES[f]);
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `Check your ${list} above.`;
}
