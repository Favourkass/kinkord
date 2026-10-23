import { GENDERS } from "./profile-options";

export const canonicalGender = (value: string): string =>
  GENDERS.find((option) => option.toLowerCase() === value.trim().toLowerCase()) ?? value.trim();

/** Keep the existing primary value for older discovery and verification consumers. */
export function genderSelectionChanges(
  country: string | null | undefined,
  values: readonly string[],
  previousGender: string | null = null,
) {
  const genders = values.map(canonicalGender);
  if (
    genders.length > 5 ||
    new Set(genders).size !== genders.length ||
    genders.some((value) => !(GENDERS as readonly string[]).includes(value))
  )
    throw new Error("Choose up to 5 distinct genders from the list.");
  if (
    ["NG", "NIGERIA"].includes(country?.trim().toUpperCase() ?? "NG") &&
    genders.some((value) => value !== "Male" && value !== "Female")
  )
    throw new Error("Only Male and Female are available for Nigeria.");
  const gender =
    previousGender && genders.includes(canonicalGender(previousGender))
      ? previousGender
      : (genders[0] ?? null);
  return { genders, gender };
}
