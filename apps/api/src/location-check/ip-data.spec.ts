import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { dataMonths, fetchIpData } from "./ip-data";

const file = gzipSync(Buffer.alloc(600_000, 7));
const ok = () => new Response(file);

describe("dataMonths", () => {
  it("is this month, then last, across a new year", () => {
    expect(dataMonths(new Date("2026-11-02T00:00:00Z"))).toEqual(["2026-11", "2026-10"]);
    expect(dataMonths(new Date("2027-01-01T00:00:00Z"))).toEqual(["2027-01", "2026-12"]);
  });
});

describe("fetchIpData", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves both files, falling back to last month's when this month's isn't out", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("2026-11") ? new Response("", { status: 404 }) : ok(),
    );
    vi.stubGlobal("fetch", fetch);
    const dir = await mkdtemp(join(tmpdir(), "ip-data-"));
    await fetchIpData(dir, { now: new Date("2026-11-02T00:00:00Z"), pauseMs: 0 });
    expect((await readFile(join(dir, "dbip-country-lite.mmdb"))).length).toBe(600_000);
    expect((await readFile(join(dir, "dbip-asn-lite.mmdb"))).length).toBe(600_000);
    expect(fetch).toHaveBeenCalledWith(
      "https://download.db-ip.com/free/dbip-country-lite-2026-10.mmdb.gz",
      expect.anything(),
    );
  });

  it("tries a failing download three times before giving up on it", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetch);
    const dir = await mkdtemp(join(tmpdir(), "ip-data-"));
    await expect(fetchIpData(dir, { pauseMs: 0 })).rejects.toThrow("offline");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("refuses an error page posing as the file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(gzipSync(Buffer.from("<html>")))),
    );
    const dir = await mkdtemp(join(tmpdir(), "ip-data-"));
    await expect(fetchIpData(dir, { pauseMs: 0 })).rejects.toThrow(/only \d+ bytes/);
  });
});
