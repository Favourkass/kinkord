import { describe, it, expect } from "vitest";
import { banksService } from "./banks.service";
describe("Nigerian bank directory", () => {
  it("includes commercial banks, OPay and Kuda, with nothing to fetch from elsewhere", () => {
    expect(banksService.count).toBeGreaterThan(600);
    for (const query of ["OPay", "Kuda", "UBA", "Zenith"]) {
      const banks = banksService.options(query);
      expect(banks.length).toBeGreaterThan(0);
      expect(JSON.stringify(banks[0])).not.toMatch(/https?:/);
    }
  });
  it("searches aliases and codes without case or punctuation sensitivity", () => {
    expect(banksService.options(" paycom ")[0].name).toContain("OPay");
    expect(banksService.options("090267")[0].name).toBe("Kuda");
    expect(banksService.find("UBA")?.name).toBe("United Bank for Africa");
    expect(banksService.options("no bank with this name")).toEqual([]);
  });
});
