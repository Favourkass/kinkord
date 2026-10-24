import { describe, it, expect } from "vitest";
import continents from "./country-continents";
describe("continent membership", () => {
  it("covers supported signup countries without treating a country as a continent", () => {
    expect(continents).toMatchObject({ NG: "AF", GH: "AF", KE: "AF", US: "NA" });
    expect(continents.GB).toBe("EU");
    expect(continents.AU).toBe("OC");
    expect(continents.BR).toBe("SA");
    expect(continents.unknown).toBeUndefined();
  });
  it("contains ISO country keys and recognised continent values", () => {
    expect(Object.keys(continents).length).toBeGreaterThan(240);
    for (const [country, continent] of Object.entries(continents)) {
      expect(country).toMatch(/^[A-Z]{2}$/);
      expect(["AF", "AN", "AS", "EU", "NA", "OC", "SA"]).toContain(continent);
    }
  });
});
