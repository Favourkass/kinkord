import { validateAbout, type AboutDraft, type SignupField } from "@/domain/onboarding";
import { LAUNCH_COUNTRIES, signupFixFieldsMessage } from "@/constants/onboarding";
import { KEEP_TYPING, PLACE_NAMES_CREDIT, typedPlaceLabel } from "@/constants/location";
import { statesForCountry } from "./location.service";

export function signupCountryOptions() {
  return [...LAUNCH_COUNTRIES]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((country) => ({ value: country.code, label: country.name, icon: country.flag }));
}

export const OTHER_AREA = "__other_area__";

/** A state's towns, fetched once it is picked (location.service). */
export interface LoadedAreas {
  areas: readonly string[];
  loading: boolean;
}
const NO_AREAS: LoadedAreas = { areas: [], loading: false };

export function signupLocationFields(
  country: string | null,
  state: string,
  customArea = false,
  loaded: LoadedAreas = NO_AREAS,
) {
  const code = country?.toUpperCase() ?? "";
  const county = code === "KE";
  const region = code === "GH";
  const term = county ? "county" : region ? "region" : "state";
  return {
    stateLabel: county ? "County" : region ? "Region" : "State",
    statePlaceholder: `Select your ${term}`,
    helper: `Your ${term} and region / city / town help us show you local communities and events.`,
    credit: PLACE_NAMES_CREDIT,
    stateSearchPlaceholder: `Search ${county ? "counties" : region ? "regions" : "states"}`,
    states: statesForCountry(code).map((value) => ({ value, label: value })),
    areaLabel: "Region / City / Town",
    areaPlaceholder: !state ? `Select your ${term} first` : "Select your region, city or town",
    areaSearchPlaceholder: "Search regions / cities / towns",
    areaEmptyLabel: loaded.loading ? "Loading regions, cities and towns…" : "No matching areas",
    areaMoreLabel: KEEP_TYPING,
    areaDisabled: !state,
    customArea,
    areas: loaded.areas.map((value) => ({ value, label: value })),
    // Pinned under every search, so an unlisted town never blocks signup.
    otherArea:
      LAUNCH_COUNTRIES.some((country) => country.code === code) && state
        ? { value: OTHER_AREA, label: "Other region / city / town", typedLabel: typedPlaceLabel }
        : null,
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
