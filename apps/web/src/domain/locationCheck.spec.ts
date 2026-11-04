import { describe, expect, it } from "vitest";
import {
  accuracyLabel,
  countByDecision,
  isCheckFreePath,
  isLocationCheckNeeded,
  isLocationCheckRequired,
  isPassing,
  outcomeOf,
  safeNext,
  type LocationCheckPM,
} from "./locationCheck";

const check = (change: Partial<LocationCheckPM>): LocationCheckPM => ({
  id: "check-1",
  decision: "approved",
  hint: null,
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
    expect(outcomeOf(check({ decision: "mismatch", hint: null, detectedCountry: "GH" }))).toEqual({
      kind: "mismatch",
      vpn: false,
      detectedCountry: "GH",
    });
    expect(outcomeOf(check({ decision: "mismatch", hint: "vpn" }))).toMatchObject({
      vpn: true,
    });
  });

  it("tells a retry apart by what couldn't be read", () => {
    expect(outcomeOf(check({ decision: "retry", hint: "allow-location" })).kind).toBe(
      "allow-location",
    );
    expect(outcomeOf(check({ decision: "retry", hint: "no-connection" })).kind).toBe(
      "no-connection",
    );
    expect(outcomeOf(check({ decision: "retry", hint: "no-location" })).kind).toBe("no-location");
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

  it("isn't fooled by characters URL parsers drop", () => {
    expect(safeNext("/\t/evil.example/login", "/home")).toBe("/home");
    expect(safeNext("/\n/evil.example", "/home")).toBe("/home");
    expect(safeNext("/messages#latest", "/home")).toBe("/messages#latest");
  });
});

describe("isCheckFreePath", () => {
  it("never interrupts signed-out pages, sign-up or the check itself", () => {
    for (const path of ["/", "/signup", "/login", "/location-check", "/privacy/location"]) {
      expect(isCheckFreePath(path)).toBe(true);
    }
  });

  it("asks on the app's own pages", () => {
    for (const path of [
      "/home",
      "/messages",
      "/profile/edit/location",
      "/signups-are-not-signup",
    ]) {
      expect(isCheckFreePath(path)).toBe(false);
    }
  });
});

describe("shared rules", () => {
  it("lets through approved and travelling members only", () => {
    expect(isPassing("approved")).toBe(true);
    expect(isPassing("travel")).toBe(true);
    expect(isPassing("skipped")).toBe(false);
  });

  it("recognises the API's codes", () => {
    expect(isLocationCheckRequired({ code: "LOCATION_CHECK_REQUIRED" })).toBe(true);
    expect(isLocationCheckNeeded({ code: "LOCATION_CHECK_NEEDED" })).toBe(true);
    expect(isLocationCheckRequired(null)).toBe(false);
  });
});
