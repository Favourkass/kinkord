import { GENDERS } from "@/constants/onboarding";

export const MAX_GENDER_SELECTIONS = 5;

export function genderOptions(
  country: string | null | undefined,
  options: readonly string[] = GENDERS,
): string[] {
  const nigeria = ["NG", "NIGERIA"].includes(country?.trim().toUpperCase() ?? "NG");
  return nigeria
    ? ["Male", "Female"]
    : [
        "Male",
        "Female",
        ...options
          .filter((value) => value !== "Male" && value !== "Female")
          .sort((a, b) => a.localeCompare(b)),
      ];
}

export function selectedGenders(
  genders: readonly string[] | undefined,
  gender: string | null,
): string[] {
  return genders !== undefined
    ? [...genders]
    : gender
      ? [GENDERS.find((value) => value.toLowerCase() === gender.toLowerCase()) ?? gender]
      : [];
}

export function genderSelectionIssue(
  country: string | null | undefined,
  selected: readonly string[],
): string | null {
  if (!selected.length) return "Select at least one gender.";
  if (selected.length > MAX_GENDER_SELECTIONS) return "Choose up to 5 genders.";
  const options = genderOptions(country);
  if (
    new Set(selected).size !== selected.length ||
    selected.some((value) => !options.includes(value))
  )
    return "Choose genders from the available options for your country.";
  return null;
}
