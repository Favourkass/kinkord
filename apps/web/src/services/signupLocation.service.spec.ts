import { describe, expect, it } from "vitest";
import {
  OTHER_AREA,
  signupCountryOptions,
  signupLocationFields,
  validateSignupAbout,
  signupLocationErrorMessage,
} from "./signupLocation.service";

describe("signup countries and locations", () => {
  it("offers only Kenya and Nigeria alphabetically", () => {
    expect(signupCountryOptions().map((option) => option.value)).toEqual(["KE", "NG"]);
  });
  it.each([
    ["KE", 47, "Nairobi", "West Pokot"],
    ["NG", 37, "FCT Abuja", "Zamfara"],
  ])("includes all configured regions for %s", (code, count, capital, last) => {
    const location = signupLocationFields(String(code), "");
    const names = location.states.map((option) => option.value);
    expect(names).toHaveLength(Number(count));
    expect(new Set(names).size).toBe(Number(count));
    expect(names).toContain(capital);
    expect(names).toContain(last);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it("offers searchable towns within the selected county or state", () => {
    expect(signupLocationFields("KE", "Nairobi")).toMatchObject({
      stateLabel: "County",
      stateSearchPlaceholder: "Search counties",
      areaLabel: "Region / City / Town",
    });
    expect(signupLocationFields("US", "California").states).toEqual([]);
    const delta = signupLocationFields("NG", "Delta", false, { areas: ["Abraka"], loading: false });
    expect(delta.areas).toEqual([{ value: "Abraka", label: "Abraka" }]);
  });
  it("does not substitute Nigerian states for an unknown country", () => {
    expect(signupLocationFields("GH", "").states).toEqual([]);
  });
});

it("uses county consistently for Kenyan location copy and validation", () => {
  const location = signupLocationFields("KE", "");
  expect(location.statePlaceholder).toBe("Select your county");
  expect(location.helper).toContain("Your county and region / city / town");
  expect(
    validateSignupAbout("KE", {
      state: "",
      city: "",
      dobDay: 1,
      dobMonth: 1,
      dobYear: 1990,
      gender: "male",
    }).state,
  ).toBe("Select your county.");
  expect(signupLocationErrorMessage("KE", ["state"])).toBe("Check your county above.");
  expect(signupLocationErrorMessage("NG", ["state"])).toBe("Check your state above.");
});

it.each([
  ["NG", "Lagos", "Ikeja"],
  ["KE", "Nairobi", "Westlands"],
])("offers dependent towns and custom entry for %s", (country, parent, town) => {
  const location = signupLocationFields(country, parent, false, { areas: [town], loading: false });
  expect(location.areaLabel).toBe("Region / City / Town");
  expect(location.areaDisabled).toBe(false);
  expect(location.areas.map((area) => area.value)).toEqual([town]);
  // "Other" is pinned under every search rather than listed with the towns.
  expect(location.otherArea).toMatchObject({
    value: OTHER_AREA,
    label: "Other region / city / town",
  });
  expect(location.otherArea?.typedLabel("Ikota")).toBe("Use “Ikota”");
  expect(location.areaMoreLabel).toBe("Keep typing to narrow it down");
  expect(location.areaEmptyLabel).toBe("No matching areas");
  expect(signupLocationFields(country, "").areaDisabled).toBe(true);
  expect(signupLocationFields(country, "").areas).toEqual([]);
  expect(signupLocationFields(country, "").otherArea).toBeNull();
  expect(signupLocationFields(country, parent, true).customArea).toBe(true);
});

it("says the towns are loading until they arrive, and credits GeoNames", () => {
  const loading = signupLocationFields("NG", "Lagos", false, { areas: [], loading: true });
  expect(loading.areaEmptyLabel).toBe("Loading regions, cities and towns…");
  expect(loading.credit).toEqual({
    text: "Place names: GeoNames,",
    licence: "CC BY 4.0",
    href: "https://creativecommons.org/licenses/by/4.0/",
  });
});
