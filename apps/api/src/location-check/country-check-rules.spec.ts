import { describe, expect, it } from "vitest";
import {
  decideCountryCheck,
  MAX_COUNTRIES_PER_DAY,
  MAX_FAILURES_PER_DAY,
  MAX_NETWORK_FAILURES_PER_DAY,
  type CheckInput,
  type GpsEvidence,
  type IpEvidence,
} from "./country-check-rules";

const SERVED = ["GH", "KE", "NG", "ZA", "US"];
const LAGOS_ZONE = ["NG", "AO", "BJ", "CD", "CF", "CG", "CM", "GA", "GQ", "NE"];
const LONDON_ZONE = ["GB", "GG", "IM", "JE"];

const gpsIn = (country: string | null, extra: Partial<GpsEvidence> = {}): GpsEvidence =>
  ({
    status: "ok",
    country,
    nearby: [],
    coarse: false,
    implausible: null,
    ...extra,
  }) as GpsEvidence;
const ipIn = (country: string, anonymizer: "tor" | "hosting" | null = null): IpEvidence => ({
  status: "ok",
  country,
  anonymizer,
});

/** A member in Lagos, on MTN, choosing Nigeria: every signal agrees. */
const base: CheckInput = {
  selected: "NG",
  purpose: "signup",
  served: SERVED,
  gps: gpsIn("NG"),
  ip: ipIn("NG"),
  device: {
    automation: false,
    locationOverridden: false,
    emulator: false,
    timezoneCountries: LAGOS_ZONE,
  },
  history: {
    failures: 0,
    networkFailures: 0,
    countries: 1,
    impossibleTravel: false,
    recentHomeCheck: false,
  },
};
const decide = (change: Partial<CheckInput>) => decideCountryCheck({ ...base, ...change });
const withDevice = (device: Partial<CheckInput["device"]>) => ({
  device: { ...base.device, ...device },
});
const withHistory = (history: Partial<CheckInput["history"]>) => ({
  history: { ...base.history, ...history },
});

describe("decideCountryCheck: the CTO's approval rule", () => {
  it("approves when the GPS and the connection both match", () => {
    expect(decide({})).toEqual({ decision: "approved", reasons: ["gps_match"] });
  });

  it("approves on the GPS alone when the connection disagrees", () => {
    const outcome = decide({ ip: ipIn("GB"), ...withDevice({ timezoneCountries: null }) });
    expect(outcome.decision).toBe("approved");
    expect(outcome.reasons).toEqual(["gps_match", "ip_elsewhere"]);
  });

  it("approves on the connection alone when the GPS disagrees", () => {
    const outcome = decide({ gps: gpsIn("BJ"), ...withDevice({ timezoneCountries: null }) });
    expect(outcome.decision).toBe("approved");
    expect(outcome.reasons[0]).toBe("ip_match");
  });

  it("blocks when neither matches", () => {
    const outcome = decide({
      selected: "US",
      ...withDevice({ timezoneCountries: ["US"] }),
    });
    expect(outcome.decision).toBe("mismatch");
    expect(outcome.reasons).toEqual(["elsewhere", "ip_elsewhere", "gps_elsewhere"]);
  });

  it("asks for a retry when the GPS can't be read, and never counts it as a match", () => {
    for (const status of ["denied", "unavailable", "timeout", "unsupported"] as const) {
      expect(decide({ gps: { status } })).toMatchObject({
        decision: "retry",
        reasons: [`gps_${status}`],
      });
    }
  });

  it("asks for a retry when the connection can't be looked up, even with the GPS matching", () => {
    expect(decide({ ip: { status: "unavailable" } })).toMatchObject({
      decision: "retry",
      reasons: ["ip_unavailable"],
    });
  });

  it("asks for a retry when the reading falls in no country at all", () => {
    expect(decide({ gps: gpsIn(null) }).decision).toBe("retry");
  });

  it("counts a border town: any country within the reading's accuracy matches", () => {
    const outcome = decide({ gps: gpsIn("BJ", { nearby: ["NG"] }), ip: ipIn("BJ") });
    expect(outcome.decision).toBe("approved");
    expect(outcome.reasons[0]).toBe("gps_match");
  });
});

describe("decideCountryCheck: VPNs and proxies", () => {
  it("never blocks a VPN user whose GPS matches", () => {
    const outcome = decide({ ip: ipIn("GB", "hosting") });
    expect(outcome.decision).toBe("approved");
    expect(outcome.reasons).toContain("hosting");
  });

  it("doesn't count a connection through a VPN as a match", () => {
    const outcome = decide({ selected: "US", gps: gpsIn("NG"), ip: ipIn("US", "hosting") });
    expect(outcome).toMatchObject({ decision: "mismatch" });
    expect(outcome.reasons[0]).toBe("vpn");
  });

  it("doesn't count Tor either", () => {
    const outcome = decide({ selected: "US", gps: gpsIn("NG"), ip: ipIn("US", "tor") });
    expect(outcome.decision).toBe("mismatch");
    expect(outcome.reasons).toContain("tor");
  });

  it("doesn't trust a network-estimated position on a VPN, which may only echo the VPN", () => {
    const outcome = decide({
      selected: "US",
      gps: gpsIn("US", { coarse: true }),
      ip: ipIn("US", "hosting"),
      ...withDevice({ timezoneCountries: null }),
    });
    expect(outcome).toMatchObject({
      decision: "mismatch",
      reasons: ["vpn_location", "hosting", "gps_coarse"],
    });
  });

  it("trusts a network-estimated position on an ordinary connection", () => {
    expect(decide({ gps: gpsIn("NG", { coarse: true }) }).decision).toBe("approved");
  });
});

describe("decideCountryCheck: signals that outweigh one source", () => {
  it("lets the GPS and the clock agreeing on another country outweigh the connection", () => {
    const outcome = decide({
      selected: "NG",
      gps: gpsIn("GB"),
      ...withDevice({ timezoneCountries: LONDON_ZONE }),
    });
    expect(outcome).toMatchObject({ decision: "mismatch" });
    expect(outcome.reasons[0]).toBe("device_elsewhere");
  });

  it("lets the connection and the clock agreeing on another country outweigh the GPS", () => {
    const outcome = decide({
      selected: "NG",
      gps: gpsIn("NG"),
      ip: ipIn("GB"),
      ...withDevice({ timezoneCountries: LONDON_ZONE }),
    });
    expect(outcome).toMatchObject({ decision: "mismatch" });
    expect(outcome.reasons[0]).toBe("gps_contradicted");
  });

  it("approves a roaming visitor whose phone moved its clock to where they are", () => {
    // A UK SIM roaming in Lagos: the connection leaves from the UK, the GPS and clock say Nigeria.
    const outcome = decide({ ip: ipIn("GB") });
    expect(outcome.decision).toBe("approved");
  });

  it("records an emulated renderer, but one weak signal never overrides a match", () => {
    const outcome = decide(withDevice({ emulator: true }));
    expect(outcome.decision).toBe("approved");
    expect(outcome.reasons).toContain("emulator");
  });
});

describe("decideCountryCheck: clear signs of faking are refused", () => {
  it.each([
    ["automation", withDevice({ automation: true })],
    ["location_overridden", withDevice({ locationOverridden: true })],
    ["gps_out_of_range", { gps: gpsIn(null, { implausible: "gps_out_of_range" }) }],
    ["impossible_travel", withHistory({ impossibleTravel: true })],
  ])("refuses %s, even with everything else matching", (reason, change) => {
    expect(decide(change)).toMatchObject({ decision: "refused", reasons: [reason] });
  });
});

describe("decideCountryCheck: travellers", () => {
  const abroad = {
    purpose: "recheck" as const,
    gps: gpsIn("GB"),
    ip: ipIn("GB"),
    ...withDevice({ timezoneCountries: LONDON_ZONE }),
  };

  it("lets a member abroad outside Kinkord's countries carry on soon after a check at home", () => {
    const outcome = decide({ ...abroad, ...withHistory({ recentHomeCheck: true }) });
    expect(outcome).toMatchObject({
      decision: "travel",
      reasons: ["abroad", "ip_elsewhere", "gps_elsewhere", "timezone_elsewhere"],
    });
  });

  it("lets them carry on when roaming on their home network too", () => {
    const outcome = decide({
      ...abroad,
      ip: ipIn("NG"),
      ...withHistory({ recentHomeCheck: true }),
    });
    expect(outcome.decision).toBe("travel");
  });

  it("asks them to check at home once the travel window has passed", () => {
    expect(decide(abroad).decision).toBe("mismatch");
  });

  it("asks a member in another of Kinkord's countries to switch to it instead", () => {
    const outcome = decide({
      ...abroad,
      gps: gpsIn("GH"),
      ip: ipIn("GH"),
      ...withDevice({ timezoneCountries: ["GH"] }),
      ...withHistory({ recentHomeCheck: true }),
    });
    expect(outcome.decision).toBe("mismatch");
  });

  it("gives no travel pass while joining", () => {
    const outcome = decide({
      ...abroad,
      purpose: "signup",
      ...withHistory({ recentHomeCheck: true }),
    });
    expect(outcome.decision).toBe("mismatch");
  });

  it("gives none when the GPS abroad is only a VPN's echo", () => {
    const outcome = decide({
      ...abroad,
      gps: gpsIn("GB", { coarse: true }),
      ip: ipIn("GB", "hosting"),
      ...withHistory({ recentHomeCheck: true }),
    });
    expect(outcome.decision).toBe("mismatch");
  });

  it("gives none when the connection is in another of Kinkord's countries", () => {
    const outcome = decide({
      ...abroad,
      ip: ipIn("GH"),
      ...withHistory({ recentHomeCheck: true }),
    });
    expect(outcome.decision).toBe("mismatch");
  });
});

describe("decideCountryCheck: repeated tries", () => {
  it(`pauses after ${MAX_FAILURES_PER_DAY} failed tries in a day`, () => {
    expect(decide(withHistory({ failures: MAX_FAILURES_PER_DAY - 1 })).decision).toBe("approved");
    expect(decide(withHistory({ failures: MAX_FAILURES_PER_DAY }))).toMatchObject({
      decision: "paused",
      reasons: ["too_many_failures"],
    });
  });

  it(`pauses after trying more than ${MAX_COUNTRIES_PER_DAY} countries in a day`, () => {
    expect(decide(withHistory({ countries: MAX_COUNTRIES_PER_DAY })).decision).toBe("approved");
    expect(decide(withHistory({ countries: MAX_COUNTRIES_PER_DAY + 1 }))).toMatchObject({
      decision: "paused",
      reasons: ["too_many_countries"],
    });
  });

  it("allows many failures from one mobile network before pausing it", () => {
    expect(decide(withHistory({ networkFailures: MAX_FAILURES_PER_DAY })).decision).toBe(
      "approved",
    );
    expect(decide(withHistory({ networkFailures: MAX_NETWORK_FAILURES_PER_DAY })).decision).toBe(
      "paused",
    );
  });
});
