import { validateAbout, type AboutDraft, type SignupField } from "@/domain/onboarding";
import { LAUNCH_COUNTRIES, signupFixFieldsMessage } from "@/constants/onboarding";
import { regionsForState, statesForCountry } from "./members.service";

export function signupCountryOptions() {
  return [...LAUNCH_COUNTRIES]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((country) => ({ value: country.code, label: country.name, icon: country.flag }));
}

export const OTHER_AREA = "__other_area__";

export function signupLocationFields(country: string | null, state: string, customArea = false) {
  const code = country?.toUpperCase() ?? "";
  const county = code === "KE";
  const term = county ? "county" : "state";
  return {
    stateLabel: county ? "County" : "State",
    statePlaceholder: `Select your ${term}`,
    helper: `Your ${term} and region / city / town help us show you local communities and events.`,
    stateSearchPlaceholder: `Search ${county ? "counties" : "states"}`,
    states: statesForCountry(code).map((value) => ({ value, label: value })),
    areaMode: code === "NG" || county ? "select" : "text",
    areaLabel: "Region / City / Town",
    areaPlaceholder: !state ? `Select your ${term} first` : "Select your region, city or town",
    areaSearchPlaceholder: "Search regions / cities / towns",
    areaDisabled: !state,
    customArea,
    areas: [
      ...regionsForState(code, state).map((value) => ({ value, label: value })),
      ...((code === "NG" || county) && state
        ? [{ value: OTHER_AREA, label: "Other region / city / town" }]
        : []),
    ],
  };
}

export function validateSignupAbout(country: string | null, draft: AboutDraft) {
  const errors = validateAbout(draft);
  if (errors.state)
    errors.state = `${signupLocationFields(country, draft.state).statePlaceholder}.`;
  return errors;
}

export function signupLocationErrorMessage(country: string | null, fields: SignupField[]) {
  return signupFixFieldsMessage(fields, signupLocationFields(country, "").stateLabel.toLowerCase());
}
