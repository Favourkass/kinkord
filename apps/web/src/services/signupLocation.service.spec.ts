import { describe, expect, it } from "vitest";
import {
  signupCountryOptions,
  signupLocationFields,
  validateSignupAbout,
  signupLocationErrorMessage,
} from "./signupLocation.service";

describe("signup countries and locations", () => {
  it("orders Kenya, Nigeria and United States alphabetically", () => {
    expect(signupCountryOptions().map((option) => option.value)).toEqual(["KE", "NG", "US"]);
  });
  it.each([
    ["KE", 47, "Nairobi", "West Pokot"],
    ["NG", 37, "FCT Abuja", "Zamfara"],
    ["US", 51, "District of Columbia", "Wyoming"],
  ])("includes all configured regions for %s", (code, count, capital, last) => {
    const location = signupLocationFields(String(code), "");
    const names = location.states.map((option) => option.value);
    expect(names).toHaveLength(Number(count));
    expect(new Set(names).size).toBe(Number(count));
    expect(names).toContain(capital);
    expect(names).toContain(last);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it("offers Kenyan counties and a city field rather than Nigerian LGAs", () => {
    expect(signupLocationFields("KE", "Nairobi")).toMatchObject({
      stateLabel: "County",
      stateSearchPlaceholder: "Search counties",
      areaMode: "text",
      areas: [],
    });
    expect(signupLocationFields("US", "California")).toMatchObject({
      stateLabel: "State",
      areaMode: "text",
      areas: [],
    });
    expect(signupLocationFields("NG", "Delta").areas.map((o) => o.value)).toContain("Abraka");
  });
  it("does not substitute Nigerian states for an unknown country", () => {
    expect(signupLocationFields("GH", "").states).toEqual([]);
  });
});

it("uses county consistently for Kenyan location copy and validation", () => {
  const location = signupLocationFields("KE", "");
  expect(location.statePlaceholder).toBe("Select your county");
  expect(location.helper).toContain("Your county and area");
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
  expect(signupLocationErrorMessage("US", ["state"])).toBe("Check your state above.");
});
