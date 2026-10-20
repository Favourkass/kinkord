/** Product availability by the country selected on the account. */
export function canSelectSexuality(country: string | null | undefined): boolean {
  const code = country?.trim().toUpperCase();
  return code !== "NG" && code !== "NIGERIA";
}
