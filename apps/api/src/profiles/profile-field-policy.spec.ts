import { describe, expect, it } from "vitest";
import { canSelectSexuality } from "./profile-field-policy";

describe("canSelectSexuality", () => {
  it("is off for accounts set to Nigeria, however the country is written", () => {
    for (const country of ["NG", "ng", " Ng ", "Nigeria", "NIGERIA"])
      expect(canSelectSexuality(country)).toBe(false);
  });

  it("is on everywhere else, and before a country is chosen", () => {
    for (const country of ["KE", "GH", "US", "", null, undefined])
      expect(canSelectSexuality(country)).toBe(true);
  });
});
