import { describe, expect, it } from "vitest";
import { cellOf, evaluateGps, impossibleTravel } from "./gps-country";

const at = (lat: number, lng: number, accuracy = 30) =>
  ({ status: "ok", lat, lng, accuracy }) as const;

describe("evaluateGps", () => {
  it("finds the country a reading falls in, from the offline map", () => {
    expect(evaluateGps(at(6.52, 3.38))).toMatchObject({
      status: "ok",
      country: "NG",
      coarse: false,
    });
    expect(evaluateGps(at(5.6, -0.19))).toMatchObject({ country: "GH" });
    expect(evaluateGps(at(-1.29, 36.82))).toMatchObject({ country: "KE" });
    expect(evaluateGps(at(-26.2, 28.05))).toMatchObject({ country: "ZA" });
    expect(evaluateGps(at(40.7, -74))).toMatchObject({ country: "US" });
  });

  it("lists the neighbours within the reading's accuracy, for border towns", () => {
    // Seme, on the Nigeria–Benin border.
    const result = evaluateGps(at(6.37, 2.72, 3000));
    expect(result).toMatchObject({ status: "ok", country: "NG" });
    expect(result.status === "ok" && result.nearby).toContain("BJ");
  });

  it("finds no country at sea", () => {
    expect(evaluateGps(at(-10, -20))).toMatchObject({ country: null, nearby: [] });
  });

  it("marks a network-estimated position as coarse", () => {
    expect(evaluateGps(at(6.52, 3.38, 20_000))).toMatchObject({ country: "NG", coarse: true });
  });

  it("passes on why there is no reading", () => {
    expect(evaluateGps({ status: "denied" })).toEqual({ status: "denied" });
  });

  it.each([
    ["gps_out_of_range", at(91, 3)],
    ["gps_out_of_range", at(6, 181)],
    ["gps_perfect_accuracy", at(6.52, 3.38, 0)],
    ["gps_perfect_accuracy", at(6.52, 3.38, -5)],
    ["gps_null_island", at(0, 0)],
    ["gps_not_a_number", at(Number.NaN, 3)],
  ])("calls a reading no device gives %s", (implausible, report) => {
    expect(evaluateGps(report)).toMatchObject({ status: "ok", country: null, implausible });
  });
});

describe("cellOf", () => {
  it("keeps only 0.1° (about 11 km) of a precise reading", () => {
    expect(cellOf(at(6.5244, 3.3792))).toBe("6.5,3.4");
  });

  it("keeps nothing of a coarse, implausible or missing reading", () => {
    expect(cellOf(at(6.52, 3.38, 20_000))).toBeNull();
    expect(cellOf(at(0, 0))).toBeNull();
    expect(cellOf({ status: "timeout" })).toBeNull();
  });
});

describe("impossibleTravel", () => {
  const lagos = "6.5,3.4";
  const london = "51.5,-0.1";
  const now = new Date("2026-11-02T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  it("flags Lagos to London in an hour", () => {
    expect(impossibleTravel({ cell: lagos, at: hoursAgo(1) }, london, now)).toBe(true);
  });

  it("allows it in a day, the time a flight takes", () => {
    expect(impossibleTravel({ cell: lagos, at: hoursAgo(24) }, london, now)).toBe(false);
  });

  it("ignores short hops the rounding could explain", () => {
    expect(impossibleTravel({ cell: lagos, at: hoursAgo(0.1) }, "6.6,3.5", now)).toBe(false);
  });

  it("ignores readings too old to compare, or missing", () => {
    expect(impossibleTravel({ cell: lagos, at: hoursAgo(24 * 8) }, london, now)).toBe(false);
    expect(impossibleTravel(null, london, now)).toBe(false);
    expect(impossibleTravel({ cell: lagos, at: hoursAgo(1) }, null, now)).toBe(false);
  });
});
