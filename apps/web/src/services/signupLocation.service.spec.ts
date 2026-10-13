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
      areaMode: "select",
      areaLabel: "Region / City / Town",
    });
    expect(signupLocationFields("US", "California").states).toEqual([]);
    expect(signupLocationFields("NG", "Delta").areas.map((o) => o.value)).toContain("Abraka");
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
  const location = signupLocationFields(country, parent);
  expect(location.areaLabel).toBe("Region / City / Town");
  expect(location.areaDisabled).toBe(false);
  expect(location.areas.map((area) => area.value)).toContain(town);
  expect(location.areas.at(-1)?.value).toBe(OTHER_AREA);
  expect(signupLocationFields(country, "").areaDisabled).toBe(true);
  expect(signupLocationFields(country, "").areas).toEqual([]);
  expect(signupLocationFields(country, parent, true).customArea).toBe(true);
});

it("places Thika in Kiambu rather than Nairobi", () => {
  expect(signupLocationFields("KE", "Kiambu").areas.map((area) => area.value)).toContain("Thika");
  expect(signupLocationFields("KE", "Nairobi").areas.map((area) => area.value)).not.toContain(
    "Thika",
  );
});
