import type { SignupField } from "@/domain/onboarding";

export const LAUNCH_COUNTRIES = [
  { code: "KE", name: "Kenya", flag: "🇰🇪", dialCode: "+254" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "+234" },
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1" },
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

/** Signup role chips, including the ten additions; Edit Profile offers the same list via the API. */
export const KINK_ROLES = [
  "Acolyte",
  "Adult Baby",
  "Adult Baby Diaper Lover (ABDL)",
  "Adventurer",
  "Aesthetic Exhibitionist",
  "Aesthetic Fetishist",
  "Affection Slut",
  "Affini",
  "Aftercare Buddy",
  "Aftercare Specialist",
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
  "Email verification",
  "Preferences",
  "Profile",
] as const;

/** How the Send OTP message names each field that needs fixing. */
export const SIGNUP_FIELD_NAMES: Record<SignupField, string> = {
  username: "username",
  displayName: "display name",
  email: "email address",
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
export function signupFixFieldsMessage(fields: SignupField[], regionName = "state"): string {
  if (fields.length > 3) return "Fill in the fields marked in red above.";
  const names = fields.map((f) => (f === "state" ? regionName : SIGNUP_FIELD_NAMES[f]));
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `Check your ${list} above.`;
}

export const SEXUALITY_FIELD = {
  label: "Sexuality (optional)",
  placeholder: "Select your sexuality",
  helper: "You can leave this blank or choose Prefer not to say.",
  options: [
    "Straight",
    "Bisexual",
    "Gay",
    "Lesbian",
    "Pansexual",
    "Asexual",
    "Queer",
    "Questioning",
    "Prefer not to say",
  ],
} as const;
