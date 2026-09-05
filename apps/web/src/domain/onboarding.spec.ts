import { describe, expect, it } from "vitest";
import {
  dobToIso,
  isAdult,
  toE164,
  validateAccount,
  validateAbout,
  WIZARD_STEPS,
  type AccountDraft,
} from "./onboarding";

const account = (over: Partial<AccountDraft> = {}): AccountDraft => ({
  username: "tegamaxwell",
  displayName: "Sir T",
  email: "tega@kinkord.com",
  phoneLocal: "0803 123 4567",
  phoneCountryCode: "+234",
  password: "supersecret123",
  confirmPassword: "supersecret123",
  ...over,
});

describe("validateAccount", () => {
  it("accepts a valid draft", () => {
    expect(validateAccount(account())).toEqual({});
  });
  it("normalizes a leading @ in the username", () => {
    expect(validateAccount(account({ username: "@tegamaxwell" }))).toEqual({});
  });
  it("rejects short usernames, mismatched passwords and passwords without digits", () => {
    expect(validateAccount(account({ username: "ab" })).username).toBeTruthy();
    expect(validateAccount(account({ confirmPassword: "different" })).confirmPassword).toBeTruthy();
    expect(
      validateAccount(account({ password: "justletters", confirmPassword: "justletters" }))
        .password,
    ).toBeTruthy();
  });
  it("accepts 8-character passwords with letters and numbers (design minimum)", () => {
    expect(validateAccount(account({ password: "abcde123", confirmPassword: "abcde123" }))).toEqual(
      {},
    );
    expect(
      validateAccount(account({ password: "abc1234", confirmPassword: "abc1234" })).password,
    ).toBeTruthy();
  });
});

describe("toE164", () => {
  it("builds E.164 from NG local format, stripping the leading zero", () => {
    expect(toE164("+234", "0803 123 4567")).toBe("+2348031234567");
  });
  it("rejects junk", () => {
    expect(toE164("+234", "12")).toBeNull();
    expect(toE164("", "08031234567")).toBeNull();
  });
});

describe("dob", () => {
  it("converts wheel values to ISO and rejects impossible dates", () => {
    expect(
      dobToIso({ dobDay: 4, dobMonth: 8, dobYear: 1999, state: "", city: "", gender: null }),
    ).toBe("1999-08-04");
    expect(
      dobToIso({ dobDay: 31, dobMonth: 2, dobYear: 1999, state: "", city: "", gender: null }),
    ).toBeNull();
  });
  it("computes adulthood at the 18-year boundary", () => {
    const now = new Date("2026-08-22T12:00:00Z");
    expect(isAdult("2008-08-22", now)).toBe(true);
    expect(isAdult("2008-08-23", now)).toBe(false);
  });
  it("aggregates step errors", () => {
    const errors = validateAbout({
      dobDay: null,
      dobMonth: null,
      dobYear: null,
      state: "",
      city: "",
      gender: null,
    });
    expect(errors.dob).toBeTruthy();
    expect(errors.state).toBeTruthy();
    expect(errors.gender).toBeTruthy();
  });

  it("defines WIZARD_STEPS as 4", () => {
    expect(WIZARD_STEPS).toBe(4);
  });
});
