import { LAUNCH_COUNTRIES } from "@/constants/onboarding";
import { regionsForState, statesForCountry } from "./members.service";

export function signupCountryOptions() {
  return [...LAUNCH_COUNTRIES]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((country) => ({ value: country.code, label: `${country.flag} ${country.name}` }));
}

export function signupLocationFields(country: string | null, state: string) {
  const code = country?.toUpperCase() ?? "";
  const county = code === "KE";
  const term = county ? "county" : "state";
  return {
    stateLabel: county ? "County" : "State",
    statePlaceholder: `Select your ${term}`,
    stateSearchPlaceholder: `Search ${county ? "counties" : "states"}`,
    states: statesForCountry(code).map((value) => ({ value, label: value })),
    areaMode: code === "NG" ? "select" : "text",
    areas: regionsForState(code, state).map((value) => ({ value, label: value })),
  };
}
