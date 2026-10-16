import { describe, expect, it } from "vitest";
import { isReservedName, takesReservedName } from "./reserved-names";

describe("isReservedName", () => {
  it("finds kinkord in any case, between any other characters", () => {
    for (const name of [
      "kinkord",
      "Kinkord",
      "KINKORD official",
      "Kin_kord",
      "k.i.n.k.o.r.d",
      "the kinkord team",
      "TeamKinkord2026",
      "kin kord",
    ]) {
      expect(isReservedName(name), name).toBe(true);
    }
  });

  it("leaves other names alone, and nothing is nothing", () => {
    for (const name of ["Kink lord", "kinkster", "Kin", "kord", "kinky_ord", "", null, undefined]) {
      expect(isReservedName(name), String(name)).toBe(false);
    }
  });
});

describe("takesReservedName", () => {
  it("refuses it to a new account", () => {
    expect(takesReservedName("Kinkord")).toBe(true);
    expect(takesReservedName("kin_kord", null)).toBe(true);
    expect(takesReservedName("Ada")).toBe(false);
  });

  it("refuses a change into it, but lets a name that already has it be kept or reworded", () => {
    expect(takesReservedName("Kinkord", "Ada")).toBe(true);
    expect(takesReservedName("Kinkord", "Kinkord")).toBe(false);
    expect(takesReservedName("Kinkord Official", "kinkord")).toBe(false);
    expect(takesReservedName("Ada", "Kinkord")).toBe(false);
  });
});
