import { describe, expect, it } from "vitest";
import {
  capitalize,
  compactNumber,
  countryName,
  displayState,
  flagEmoji,
  genderInitial,
  monthYear,
  shortDate,
  timeAgo,
} from "./format";

describe("flagEmoji", () => {
  it("maps ISO codes to flag emoji and ignores junk", () => {
    expect(flagEmoji("NG")).toBe("🇳🇬");
    expect(flagEmoji("gh")).toBe("🇬🇭");
    expect(flagEmoji("ZZZ")).toBe("");
    expect(flagEmoji(null)).toBe("");
  });
});

describe("compactNumber", () => {
  it("leaves small counts alone and abbreviates thousands/millions", () => {
    expect(compactNumber(0)).toBe("0");
    expect(compactNumber(256)).toBe("256");
    expect(compactNumber(980)).toBe("980");
    expect(compactNumber(1234)).toBe("1.2K");
    expect(compactNumber(12_400)).toBe("12.4K");
    expect(compactNumber(250_000)).toBe("250K");
    expect(compactNumber(1_250_000)).toBe("1.3M");
  });
  it("never abbreviates into '1000K'", () => {
    expect(compactNumber(999_999)).toBe("1M");
  });
  it("treats invalid input as zero", () => {
    expect(compactNumber(Number.NaN)).toBe("0");
    expect(compactNumber(-5)).toBe("0");
  });
});

describe("displayState", () => {
  it("appends 'State' to bare names only", () => {
    expect(displayState("Delta")).toBe("Delta State");
    expect(displayState("Delta State")).toBe("Delta State");
    expect(displayState("FCT Abuja")).toBe("FCT Abuja");
    expect(displayState("")).toBe("");
    expect(displayState(null)).toBe("");
  });
});

describe("monthYear", () => {
  it("formats an ISO timestamp as Month YYYY in UTC", () => {
    expect(monthYear("2023-03-15T10:00:00.000Z")).toBe("March 2023");
    expect(monthYear("2023-03-01")).toBe("March 2023");
  });
  it("returns null for missing or bad input", () => {
    expect(monthYear(null)).toBeNull();
    expect(monthYear("not-a-date")).toBeNull();
  });
});

describe("countryName / genderInitial", () => {
  it("resolves ISO codes to English names and passes junk through", () => {
    expect(countryName("NG")).toBe("Nigeria");
    expect(countryName("ng")).toBe("Nigeria");
    expect(countryName("GH")).toBe("Ghana");
    expect(countryName("ZZZ")).toBe("ZZZ");
    expect(countryName(null)).toBeNull();
  });
  it("abbreviates gender without guessing", () => {
    expect(genderInitial("Female")).toBe("F");
    expect(genderInitial("male")).toBe("M");
    expect(genderInitial("non-binary")).toBe("");
    expect(genderInitial(null)).toBe("");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  const at = (secondsAgo: number) => new Date(now.getTime() - secondsAgo * 1000).toISOString();
  it("uses the presence phrasing from the design, down to seconds (CEO, 2026-09-12)", () => {
    expect(timeAgo(at(0), now)).toBe("just now");
    expect(timeAgo(at(1), now)).toBe("a second ago");
    expect(timeAgo(at(2), now)).toBe("2 seconds ago");
    expect(timeAgo(at(10), now)).toBe("10 seconds ago");
    expect(timeAgo(at(59), now)).toBe("59 seconds ago");
    expect(timeAgo(at(60), now)).toBe("a minute ago");
    expect(timeAgo(at(3 * 60), now)).toBe("3 minutes ago");
    expect(timeAgo(at(5 * 60), now)).toBe("5 minutes ago");
    expect(timeAgo(at(60 * 60), now)).toBe("an hour ago");
    expect(timeAgo(at(3 * 3600), now)).toBe("3 hours ago");
    expect(timeAgo(at(26 * 3600), now)).toBe("yesterday");
    expect(timeAgo(at(4 * 86400), now)).toBe("4 days ago");
    expect(timeAgo(at(15 * 86400), now)).toBe("2 weeks ago");
    expect(timeAgo(at(65 * 86400), now)).toBe("2 months ago");
    expect(timeAgo(at(100 * 86400), now)).toBe("3 months ago");
    expect(timeAgo(at(400 * 86400), now)).toBe("a year ago");
  });
  it("returns null for missing/invalid and never goes negative", () => {
    expect(timeAgo(null, now)).toBeNull();
    expect(timeAgo("bad", now)).toBeNull();
    expect(timeAgo(new Date(now.getTime() + 60_000).toISOString(), now)).toBe("just now");
  });
});

describe("shortDate + capitalize", () => {
  it("formats dates the way the Edit Profile rows show them", () => {
    expect(shortDate("1998-03-26")).toBe("26 Mar 1998");
    expect(shortDate("2025-05-25T10:00:00.000Z")).toBe("25 May 2025");
    expect(shortDate(null)).toBeNull();
    expect(shortDate("nope")).toBeNull();
  });
  it("capitalises stored lowercase values without touching cased ones", () => {
    expect(capitalize("female")).toBe("Female");
    expect(capitalize("Male")).toBe("Male");
    expect(capitalize(null)).toBe("");
  });
});
