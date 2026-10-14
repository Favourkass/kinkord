import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PUBLIC_DIR = path.resolve(__dirname, "../../public");
/** Serves /locations/* from the generated files, as the app's server would. */
const fromDisk = vi.fn(async (url: string) => {
  const file = path.join(PUBLIC_DIR, url);
  return fs.existsSync(file)
    ? new Response(fs.readFileSync(file, "utf8"), { status: 200 })
    : new Response("Not found", { status: 404 });
});

// A fresh module per test, so its in-memory cache starts empty.
const load = async () => import("./location.service");

beforeEach(() => {
  vi.resetModules();
  fromDisk.mockClear();
  vi.stubGlobal("fetch", fromDisk);
});
afterEach(() => vi.unstubAllGlobals());

describe("states and counties", () => {
  it("lists the 37 Nigerian states and 47 Kenyan counties, sorted, and nothing else", async () => {
    const { statesForCountry, isKnownState } = await load();
    expect(statesForCountry("ng")).toHaveLength(37);
    expect(statesForCountry("NG")).toContain("FCT Abuja");
    expect(statesForCountry("KE")).toHaveLength(47);
    expect(statesForCountry("KE")).toEqual(
      [...statesForCountry("KE")].sort((a, b) => a.localeCompare(b)),
    );
    expect(statesForCountry("GH")).toEqual([]);
    expect(isKnownState("ng", "Delta")).toBe(true);
    expect(isKnownState("KE", "Delta")).toBe(false);
    expect(isKnownState("NG", null)).toBe(false);
  });

  it("has a place list on disk for every state and county", async () => {
    const { locationSlug, statesForCountry } = await load();
    expect(locationSlug("Akwa Ibom")).toBe("akwa-ibom");
    expect(locationSlug("Murang’a")).toBe("muranga");
    for (const country of ["NG", "KE"])
      for (const state of statesForCountry(country))
        expect(
          fs.existsSync(path.join(PUBLIC_DIR, "locations", country, `${locationSlug(state)}.json`)),
          `${country}/${state}`,
        ).toBe(true);
  });
});

describe("regionsForState", () => {
  it("fetches a state's places once and reuses them", async () => {
    const { regionsForState } = await load();
    const delta = await regionsForState("ng", "Delta");
    expect(delta).toContain("Abraka");
    expect(delta).toContain("Asaba");
    expect(await regionsForState("KE", "Kiambu")).toContain("Thika");
    expect(await regionsForState("KE", "Nairobi")).not.toContain("Thika");
    expect(await regionsForState("NG", "Delta")).toBe(delta);
    expect(fromDisk.mock.calls.map(([url]) => url)).toEqual([
      "/locations/NG/delta.json",
      "/locations/KE/kiambu.json",
      "/locations/KE/nairobi.json",
    ]);
  });

  it("asks for nothing it has no list for", async () => {
    const { regionsForState } = await load();
    expect(await regionsForState("NG", "Atlantis")).toEqual([]);
    expect(await regionsForState("GH", "Ashanti")).toEqual([]);
    expect(fromDisk).not.toHaveBeenCalled();
  });

  it("returns nothing when offline, and tries again next time", async () => {
    const { regionsForState } = await load();
    fromDisk.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await regionsForState("NG", "Lagos")).toEqual([]);
    fromDisk.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    expect(await regionsForState("NG", "Lagos")).toEqual([]);
    expect(await regionsForState("NG", "Lagos")).toContain("Ikeja");
    expect(fromDisk).toHaveBeenCalledTimes(3);
  });
});
