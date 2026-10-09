import { describe, it, expect } from "vitest";
import { banksService } from "./banks.service";
describe("Nigerian bank directory", () => {
  it("includes commercial banks, OPay and Kuda with pinned logo assets", () => {
    expect(banksService.count).toBeGreaterThan(600);
    for (const query of ["OPay", "Kuda", "UBA", "Zenith"]) {
      const banks = banksService.options(query);
      expect(banks.length).toBeGreaterThan(0);
      expect(banks[0].logo).toMatch(/@d564612d7f439ac129c8b4fe64828a33f28811e3\//);
    }
  });
  it("searches aliases and codes without case or punctuation sensitivity", () => {
    expect(banksService.options(" paycom ")[0].name).toContain("OPay");
    expect(banksService.options("090267")[0].name).toBe("Kuda");
    expect(banksService.find("UBA")?.name).toBe("United Bank for Africa");
    expect(banksService.options("no bank with this name")).toEqual([]);
  });
});
