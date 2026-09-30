import { describe, expect, it } from "vitest";
import {
  dobToIso,
  invalidSignupFields,
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
  it("accepts 10-character passwords with letters and numbers (design minimum)", () => {
    expect(
      validateAccount(account({ password: "abcde12345", confirmPassword: "abcde12345" })),
    ).toEqual({});
    // 8 characters is now below the minimum and must be rejected.
    expect(
      validateAccount(account({ password: "abcde123", confirmPassword: "abcde123" })).password,
    ).toBeTruthy();
  });
});

describe("validateAccount: phone", () => {
  it("requires a phone number", () => {
    expect(validateAccount(account({ phoneLocal: "  " })).phoneLocal).toBe(
      "Enter your phone number.",
    );
  });
  it("still rejects a number that isn't one", () => {
    expect(validateAccount(account({ phoneLocal: "12" })).phoneLocal).toBe(
      "Enter a valid phone number.",
    );
  });
  it("accepts the full international number Chrome autofill puts in the box", () => {
    expect(validateAccount(account({ phoneLocal: "+2348031234567" })).phoneLocal).toBeUndefined();
  });
});

describe("toE164", () => {
  it("builds E.164 from NG local format, stripping the leading zero", () => {
    expect(toE164("+234", "0803 123 4567")).toBe("+2348031234567");
  });
  it("recognises a country code typed or autofilled into the local box", () => {
    for (const typed of [
      "+2348031234567",
      "+234 803 123 4567",
      "+234 0803 123 4567",
      "002348031234567",
      "2348031234567",
      "(+234) 803-123-4567",
    ]) {
      expect(toE164("+234", typed)).toBe("+2348031234567");
    }
    expect(toE164("+44", "+44 7911 123456")).toBe("+447911123456");
    expect(toE164("+1", "1 555 123 4567")).toBe("+15551234567");
  });
  it("keeps a full number for another country as typed", () => {
    expect(toE164("+234", "+44 7911 123456")).toBe("+447911123456");
  });
  it("doesn't mistake a short national number for one with the code", () => {
    // 10 digits that merely start with 234: too short to also hold the code.
    expect(toE164("+234", "2341234567")).toBe("+2342341234567");
  });
  it("rejects junk", () => {
    expect(toE164("+234", "12")).toBeNull();
    expect(toE164("", "08031234567")).toBeNull();
  });
});

describe("invalidSignupFields", () => {
  it("lists failing fields in on-screen order across both steps", () => {
    expect(
      invalidSignupFields({ confirmPassword: "x", phoneLocal: "x" }, { gender: "x", dob: "x" }),
    ).toEqual(["phoneLocal", "confirmPassword", "dob", "gender"]);
    expect(invalidSignupFields({}, {})).toEqual([]);
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

  it("defines WIZARD_STEPS as 5", () => {
    expect(WIZARD_STEPS).toBe(5);
  });
});
