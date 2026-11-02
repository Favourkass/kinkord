import { describe, expect, it } from "vitest";
import { lookupIn, NetworkIntelService, type IpSources } from "./network-intel.service";

const reader = <T>(answers: Record<string, T>) => ({
  get: (ip: string) => answers[ip] ?? null,
});

const sources: IpSources = {
  country: reader({
    "102.89.32.1": { country: { iso_code: "NG" } },
    "89.238.128.1": { country: { iso_code: "GB" } },
    "185.220.101.1": { country: { iso_code: "DE" } },
  }) as never,
  asn: reader({
    "102.89.32.1": {
      autonomous_system_number: 29465,
      autonomous_system_organization: "MTN NIGERIA Communication limited",
    },
    "89.238.128.1": {
      autonomous_system_number: 9009,
      autonomous_system_organization: "M247 Europe SRL",
    },
  }) as never,
  tor: new Set(["185.220.101.1"]),
};

describe("lookupIn", () => {
  it("finds the country and the network of an ordinary connection", () => {
    expect(lookupIn(sources, "102.89.32.1")).toEqual({
      evidence: { status: "ok", country: "NG", anonymizer: null },
      asn: 29465,
      network: "MTN NIGERIA Communication limited",
    });
  });

  it("marks hosting networks and Tor exits", () => {
    expect(lookupIn(sources, "89.238.128.1").evidence).toEqual({
      status: "ok",
      country: "GB",
      anonymizer: "hosting",
    });
    expect(lookupIn(sources, "185.220.101.1").evidence).toEqual({
      status: "ok",
      country: "DE",
      anonymizer: "tor",
    });
  });

  it("is unavailable without an address, a valid one, a known one, or the data", () => {
    expect(lookupIn(sources, null).evidence.status).toBe("unavailable");
    expect(lookupIn(sources, "not-an-ip").evidence.status).toBe("unavailable");
    expect(lookupIn(sources, "203.0.113.9").evidence.status).toBe("unavailable");
    expect(lookupIn({ ...sources, country: null }, "102.89.32.1").evidence.status).toBe(
      "unavailable",
    );
  });

  it("is unavailable when the data can't be read", () => {
    const broken = {
      ...sources,
      country: {
        get: () => {
          throw new Error("corrupt");
        },
      },
    } as IpSources;
    expect(lookupIn(broken, "102.89.32.1").evidence.status).toBe("unavailable");
  });
});

describe("NetworkIntelService", () => {
  it("answers unavailable, and says so on the founders' page, until its data loads", () => {
    const intel = new NetworkIntelService();
    expect(intel.lookup("102.89.32.1").evidence.status).toBe("unavailable");
    expect(intel.status()).toEqual({
      countryDataBuiltAt: null,
      networkDataBuiltAt: null,
      torExits: 0,
      torUpdatedAt: null,
    });
  });
});
