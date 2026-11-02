import { describe, expect, it } from "vitest";
import {
  accuracyLabel,
  countByDecision,
  outcomeOf,
  safeNext,
  type LocationCheckPM,
} from "./locationCheck";

const check = (change: Partial<LocationCheckPM>): LocationCheckPM => ({
  id: "check-1",
  decision: "approved",
  reasons: ["gps_match"],
  enforced: true,
  detectedCountry: "NG",
  ...change,
});

describe("outcomeOf", () => {
  it("lets an approved or travelling member on, with the check that let them", () => {
    expect(outcomeOf(check({}))).toEqual({ kind: "pass", checkId: "check-1" });
    expect(outcomeOf(check({ decision: "travel" }))).toEqual({ kind: "pass", checkId: "check-1" });
  });

  it("lets everyone on while the check only watches", () => {
    expect(outcomeOf(check({ decision: "mismatch", enforced: false }))).toEqual({
      kind: "pass",
      checkId: "check-1",
    });
  });

  it("explains a mismatch, mentioning the VPN when one was the reason", () => {
    expect(
      outcomeOf(check({ decision: "mismatch", reasons: ["elsewhere"], detectedCountry: "GH" })),
    ).toEqual({
      kind: "mismatch",
      vpn: false,
      detectedCountry: "GH",
    });
    expect(outcomeOf(check({ decision: "mismatch", reasons: ["vpn", "hosting"] }))).toMatchObject({
      vpn: true,
    });
  });

  it("tells a retry apart by what couldn't be read", () => {
    expect(outcomeOf(check({ decision: "retry", reasons: ["gps_denied"] })).kind).toBe(
      "allow-location",
    );
    expect(outcomeOf(check({ decision: "retry", reasons: ["ip_unavailable"] })).kind).toBe(
      "no-connection",
    );
    expect(outcomeOf(check({ decision: "retry", reasons: ["gps_timeout"] })).kind).toBe(
      "no-location",
    );
  });

  it("passes on a refusal and a pause", () => {
    expect(outcomeOf(check({ decision: "refused" })).kind).toBe("refused");
    expect(outcomeOf(check({ decision: "paused" })).kind).toBe("paused");
  });
});

describe("countByDecision", () => {
  it("adds up each decision across purposes", () => {
    const totals = countByDecision([
      { purpose: "signup", decision: "approved", count: 4 },
      { purpose: "recheck", decision: "approved", count: 3 },
      { purpose: "recheck", decision: "mismatch", count: 1 },
    ]);
    expect(totals).toMatchObject({ approved: 7, mismatch: 1, refused: 0 });
  });
});

describe("accuracyLabel", () => {
  it("reads metres and kilometres", () => {
    expect(accuracyLabel(25)).toBe("25 m");
    expect(accuracyLabel(4200)).toBe("4.2 km");
    expect(accuracyLabel(25_000)).toBe("25 km");
    expect(accuracyLabel(null)).toBeNull();
  });
});

describe("safeNext", () => {
  it("returns only to paths inside the app", () => {
    expect(safeNext("/messages?c=7", "/home")).toBe("/messages?c=7");
    expect(safeNext("https://evil.example", "/home")).toBe("/home");
    expect(safeNext("//evil.example", "/home")).toBe("/home");
    expect(safeNext("/\\evil.example", "/home")).toBe("/home");
    expect(safeNext(null, "/home")).toBe("/home");
  });
});
