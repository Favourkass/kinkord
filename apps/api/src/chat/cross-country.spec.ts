import { describe, expect, it } from "vitest";
import { DEFAULT_COUNTRY, differentCountries } from "./cross-country";

describe("differentCountries", () => {
  it("compares the two members' saved countries", () => {
    expect(differentCountries("NG", "KE")).toBe(true);
    expect(differentCountries("KE", "KE")).toBe(false);
  });

  it("reads a member with no country saved as Nigerian", () => {
    expect(DEFAULT_COUNTRY).toBe("NG");
    expect(differentCountries(null, "NG")).toBe(false);
    expect(differentCountries(undefined, null)).toBe(false);
    expect(differentCountries(null, "KE")).toBe(true);
  });
});
