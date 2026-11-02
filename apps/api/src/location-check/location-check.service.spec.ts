import { afterEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, HttpException } from "@nestjs/common";
import { type Db } from "../db/db.module";
import { locationCheck, locationStatus, profile, user } from "../db/schema";
import { LocationCheckService, PASS_VALID_MS, type CheckRequest } from "./location-check.service";
import { type LocationCheckMode, type LocationSettingsService } from "./location-settings.service";
import { type IpLookup, type NetworkIntelService } from "./network-intel.service";

/**
 * A stand-in for drizzle that answers each query from a queue per table and
 * records every write. Selects take from `reads`, `.returning()` from
 * `returns`.
 */
function fakeDb() {
  const reads = new Map<unknown, unknown[][]>();
  const returns = new Map<unknown, unknown[][]>();
  const writes: Array<{ op: "insert" | "update" | "delete"; table: unknown; values?: unknown }> =
    [];
  const take = (queues: Map<unknown, unknown[][]>, table: unknown) =>
    queues.get(table)?.shift() ?? [];

  const selectChain = () => {
    let table: unknown;
    const chain: Record<string, unknown> = {};
    for (const step of ["where", "limit", "orderBy", "leftJoin", "groupBy"]) {
      chain[step] = () => chain;
    }
    // A query over raw SQL (the summary's unnest) reads from the "raw" queue.
    chain.from = (t: unknown) => {
      table = typeof t === "object" && t !== null && "queryChunks" in t ? "raw" : t;
      return chain;
    };
    chain.then = (resolve: (rows: unknown[]) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(take(reads, table)).then(resolve, reject);
    return chain;
  };

  const db = {
    select: vi.fn(() => selectChain()),
    selectDistinctOn: vi.fn(() => selectChain()),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        writes.push({ op: "insert", table, values });
        return {
          returning: async () => take(returns, table),
          onConflictDoUpdate: async () => undefined,
        };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: unknown) => {
        writes.push({ op: "update", table, values });
        const done = Promise.resolve(undefined);
        return {
          where: () => Object.assign(done, { returning: async () => take(returns, table) }),
        };
      },
    })),
    delete: vi.fn((table: unknown) => ({
      where: async () => {
        writes.push({ op: "delete", table });
      },
    })),
  };
  const queue =
    (map: Map<unknown, unknown[][]>) =>
    (table: unknown, ...rows: unknown[][]) => {
      map.set(table, [...(map.get(table) ?? []), ...rows]);
    };
  return {
    db: db as unknown as Db,
    reads: queue(reads),
    returns: queue(returns),
    writes,
    written: (op: string, table: unknown) =>
      writes.filter((w) => w.op === op && w.table === table).map((w) => w.values),
  };
}

const MTN: IpLookup = {
  evidence: { status: "ok", country: "NG", anonymizer: null },
  asn: 29465,
  network: "MTN NIGERIA Communication limited",
};

function make(opts: { mode?: LocationCheckMode; ip?: IpLookup } = {}) {
  const fake = fakeDb();
  const intel = {
    lookup: vi.fn(() => opts.ip ?? MTN),
    status: vi.fn(() => ({ torExits: 0 })),
  } as unknown as NetworkIntelService;
  const settings = {
    mode: vi.fn(async () => opts.mode ?? "enforce"),
  } as unknown as LocationSettingsService;
  return { ...fake, service: new LocationCheckService(fake.db, intel, settings), intel };
}

const now = new Date("2026-11-02T12:00:00Z");
const lagosPhone = {
  timezone: "Africa/Lagos",
  automation: false,
  geolocationNative: true,
  renderer: "Adreno (TM) 610",
};
const joining: CheckRequest = {
  member: null,
  country: "NG",
  gps: { status: "ok", lat: 6.5244, lng: 3.3792, accuracy: 25 },
  device: lagosPhone,
  deviceId: "device-1234",
  ip: "102.89.32.1",
};
const member = { id: "u1", country: "NG" };

afterEach(() => vi.unstubAllEnvs());

describe("LocationCheckService.check", () => {
  it("records a check while joining, without the coordinates", async () => {
    const { service, reads, returns, written } = make();
    reads(locationCheck, []);
    returns(locationCheck, [{ id: "check-1" }]);
    const result = await service.check(joining, now);
    expect(result).toEqual({
      id: "check-1",
      decision: "approved",
      reasons: ["gps_match"],
      enforced: true,
      detectedCountry: "NG",
    });
    const [row] = written("insert", locationCheck);
    expect(row).toMatchObject({
      userId: null,
      purpose: "signup",
      selectedCountry: "NG",
      gpsStatus: "ok",
      gpsCountry: "NG",
      gpsAccuracyM: 25,
      ipCountry: "NG",
      ipAsn: 29465,
      ipAnonymizer: null,
      timezone: "Africa/Lagos",
      decision: "approved",
      enforced: true,
      deviceId: "device-1234",
    });
    expect(JSON.stringify(row)).not.toMatch(/6\.52|3\.37/);
    expect(written("insert", locationStatus)).toEqual([]);
  });

  it("refuses to run while switched off", async () => {
    const { service } = make({ mode: "off" });
    await expect(service.check(joining, now)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("renews a member's standing when a recheck at home passes", async () => {
    const { service, reads, returns, written } = make();
    reads(locationStatus, []);
    reads(locationCheck, []);
    returns(locationCheck, [{ id: "check-2" }]);
    await service.check({ ...joining, member }, now);
    expect(written("insert", locationStatus)).toEqual([
      {
        userId: "u1",
        checkedAt: now,
        checkedCountry: "NG",
        status: "approved",
        approvedAt: now,
        cell: "6.5,3.4",
        cellAt: now,
      },
    ]);
  });

  it("only watching, lets a failed recheck through as observed", async () => {
    const { service, reads, returns, written } = make({ mode: "watch" });
    reads(locationStatus, []);
    reads(locationCheck, []);
    returns(locationCheck, [{ id: "check-3" }]);
    const result = await service.check(
      { ...joining, member, country: "NG", gps: { status: "denied" } },
      now,
    );
    expect(result).toMatchObject({ decision: "retry", enforced: false });
    expect(written("insert", locationStatus)).toEqual([
      expect.objectContaining({ status: "observed", checkedCountry: "NG" }),
    ]);
  });

  it("enforcing, leaves the standing alone when a recheck fails", async () => {
    const { service, reads, returns, written } = make();
    reads(locationStatus, []);
    reads(locationCheck, []);
    returns(locationCheck, [{ id: "check-4" }]);
    await service.check({ ...joining, member, gps: { status: "denied" } }, now);
    expect(written("insert", locationStatus)).toEqual([]);
  });

  it("leaves the standing for the switch itself when checking a new country", async () => {
    const { service, reads, returns, written } = make({
      ip: { ...MTN, evidence: { status: "ok", country: "GH", anonymizer: null } },
    });
    reads(locationStatus, [{ cell: null, cellAt: null, approvedAt: null, checkedCountry: "NG" }]);
    reads(locationCheck, []);
    returns(locationCheck, [{ id: "check-5" }]);
    const result = await service.check(
      {
        ...joining,
        member,
        country: "GH",
        gps: { status: "ok", lat: 5.6, lng: -0.19, accuracy: 20 },
        device: { ...lagosPhone, timezone: "Africa/Accra" },
      },
      now,
    );
    expect(result).toMatchObject({ decision: "approved", detectedCountry: "GH" });
    expect(written("insert", locationCheck)[0]).toMatchObject({ purpose: "change" });
    expect(written("insert", locationStatus)).toEqual([]);
    expect(written("update", locationStatus)).toEqual([{ cell: "5.6,-0.2", cellAt: now }]);
  });

  it("counts a member's failed tries in the last day towards a pause", async () => {
    const { service, reads, returns } = make();
    reads(locationStatus, []);
    reads(
      locationCheck,
      Array.from({ length: 5 }, () => ({ decision: "mismatch", country: "NG" })),
    );
    returns(locationCheck, [{ id: "check-6" }]);
    const result = await service.check({ ...joining, member }, now);
    expect(result).toMatchObject({ decision: "paused", reasons: ["too_many_failures"] });
  });

  it("refuses a connection sending checks by the hundred", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    const { service, reads } = make();
    reads(locationCheck, [{ count: 120 }]);
    await expect(service.check(joining, now)).rejects.toBeInstanceOf(HttpException);
  });
});

describe("LocationCheckService.memberOf", () => {
  it("reads the member's profile country", async () => {
    const { service, reads } = make();
    reads(profile, [{ country: "KE" }]);
    expect(await service.memberOf("u1")).toEqual({ id: "u1", country: "KE" });
    expect(await service.memberOf("u2")).toEqual({ id: "u2", country: null });
  });
});

describe("LocationCheckService.skip", () => {
  it("records a skipped check, only while watching", async () => {
    const { service, returns, written } = make({ mode: "watch" });
    returns(locationCheck, [{ id: "check-7" }]);
    const result = await service.skip(
      { member: null, country: "NG", deviceId: null, ip: null },
      now,
    );
    expect(result).toMatchObject({ decision: "skipped", enforced: false });
    expect(written("insert", locationCheck)[0]).toMatchObject({
      gpsStatus: "skipped",
      decision: "skipped",
    });
  });

  it("can't be skipped while enforcing", async () => {
    const { service } = make({ mode: "enforce" });
    await expect(
      service.skip({ member: null, country: "NG", deviceId: null, ip: null }, now),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("LocationCheckService sign-up claims", () => {
  it("needs no check while switched off", async () => {
    const { service } = make({ mode: "off" });
    expect(await service.claimForSignup(null, "NG", now)).toEqual({ allowed: true, claim: null });
  });

  it("enforcing, refuses a sign-up without an approved check", async () => {
    const { service } = make();
    expect(await service.claimForSignup(null, "NG", now)).toEqual({ allowed: false, claim: null });
    expect(await service.claimForSignup("check-1", "NG", now)).toEqual({
      allowed: false,
      claim: null,
    });
  });

  it("enforcing, spends an approved check on the sign-up", async () => {
    const { service, returns, written } = make();
    returns(locationCheck, [{ id: "check-1", decision: "approved" }]);
    expect(await service.claimForSignup("check-1", "NG", now)).toEqual({
      allowed: true,
      claim: { id: "check-1", decision: "approved", country: "NG" },
    });
    expect(written("update", locationCheck)).toEqual([{ consumedAt: now }]);
  });

  it("watching, lets anyone join and links whatever check there was", async () => {
    const { service, returns } = make({ mode: "watch" });
    expect(await service.claimForSignup(null, "NG", now)).toEqual({ allowed: true, claim: null });
    returns(locationCheck, [{ id: "check-2", decision: "mismatch" }]);
    expect(await service.claimForSignup("check-2", "NG", now)).toMatchObject({
      allowed: true,
      claim: { id: "check-2" },
    });
  });

  it("gives the new account the standing its check earned", async () => {
    const { service, written } = make();
    await service.attachSignupClaim(
      { id: "check-1", decision: "approved", country: "NG" },
      "u1",
      now,
    );
    expect(written("update", locationCheck)).toEqual([{ userId: "u1" }]);
    expect(written("insert", locationStatus)).toEqual([
      { userId: "u1", checkedAt: now, checkedCountry: "NG", status: "approved", approvedAt: now },
    ]);
  });

  it("only observes a member who joined on a failed check while watching", async () => {
    const { service, written } = make({ mode: "watch" });
    await service.attachSignupClaim({ id: "check-2", decision: "retry", country: "NG" }, "u1", now);
    expect(written("insert", locationStatus)[0]).toMatchObject({ status: "observed" });
    expect(written("insert", locationStatus)[0]).not.toHaveProperty("approvedAt");
  });

  it("makes a released check usable again", async () => {
    const { service, written } = make();
    await service.releaseSignupClaim({ id: "check-1", decision: "approved", country: "NG" });
    expect(written("update", locationCheck)).toEqual([{ consumedAt: null }]);
  });

  it("keeps a pass for half an hour", () => {
    expect(PASS_VALID_MS).toBe(30 * 60 * 1000);
  });
});

describe("LocationCheckService.authorizeCountryChange", () => {
  const person = { email: "member@kinkord.com", emailVerified: true, accountType: "person" };

  it("is free unless enforcing", async () => {
    const { service } = make({ mode: "watch" });
    expect(await service.authorizeCountryChange("u1", "GH", now)).toBe("free");
  });

  it("is free for founders and organisations", async () => {
    const founder = make();
    founder.reads(user, [{ ...person, email: "nnabuekassidy@gmail.com" }]);
    expect(await founder.service.authorizeCountryChange("u1", "GH", now)).toBe("free");
    const org = make();
    org.reads(user, [{ ...person, accountType: "organization" }]);
    expect(await org.service.authorizeCountryChange("u1", "GH", now)).toBe("free");
  });

  it("refuses clearing the country, which would lift Nigeria's limits", async () => {
    const { service, reads } = make();
    reads(user, [person]);
    expect(await service.authorizeCountryChange("u1", null, now)).toBe("missing");
  });

  it("needs an approved check for the new country", async () => {
    const { service, reads } = make();
    reads(user, [person]);
    reads(locationCheck, []);
    expect(await service.authorizeCountryChange("u1", "GH", now)).toBe("missing");
  });

  it("spends that check and records the member there", async () => {
    const { service, reads, returns, written } = make();
    reads(user, [person]);
    reads(locationCheck, [{ id: "check-9" }]);
    returns(locationCheck, [{ id: "check-9" }]);
    expect(await service.authorizeCountryChange("u1", "GH", now)).toBe("claimed");
    expect(written("insert", locationStatus)).toEqual([
      { userId: "u1", checkedAt: now, checkedCountry: "GH", status: "approved", approvedAt: now },
    ]);
  });

  it("won't spend a check twice", async () => {
    const { service, reads, returns } = make();
    reads(user, [person]);
    reads(locationCheck, [{ id: "check-9" }]);
    returns(locationCheck, []);
    expect(await service.authorizeCountryChange("u1", "GH", now)).toBe("missing");
  });
});

describe("LocationCheckService.needsCheck", () => {
  const signedIn = {
    user: { id: "u1", email: "member@kinkord.com", emailVerified: true },
    sessionCreatedAt: new Date("2026-10-30T09:00:00Z"),
    ip: "102.89.32.1",
    profile: { country: "NG", accountType: "person" as const },
  };
  const standing = (change: Record<string, unknown> = {}) => ({
    status: "approved",
    checkedCountry: "NG",
    checkedAt: new Date("2026-11-01T09:00:00Z"),
    approvedAt: new Date("2026-11-01T09:00:00Z"),
    cell: null,
    cellAt: null,
    ...change,
  });
  const ask = async (
    row: Record<string, unknown> | null,
    opts: { mode?: LocationCheckMode; ip?: IpLookup } = {},
    q = signedIn,
  ) => {
    const { service, reads } = make(opts);
    reads(locationStatus, row ? [row] : []);
    return service.needsCheck(q, now);
  };

  it("never asks while switched off, nor founders or organisations", async () => {
    expect(await ask(null, { mode: "off" })).toBe(false);
    expect(
      await ask(
        null,
        {},
        { ...signedIn, user: { ...signedIn.user, email: "maxihandsome@gmail.com" } },
      ),
    ).toBe(false);
    expect(
      await ask(null, {}, { ...signedIn, profile: { country: "NG", accountType: "organization" } }),
    ).toBe(false);
  });

  it("asks a member who has never checked", async () => {
    expect(await ask(null)).toBe(true);
  });

  it("lets a member with a recent check at home through", async () => {
    expect(await ask(standing())).toBe(false);
  });

  it("enforcing, asks again after a check that was only observed", async () => {
    expect(await ask(standing({ status: "observed" }))).toBe(true);
    expect(await ask(standing({ status: "observed" }), { mode: "watch" })).toBe(false);
  });

  it("asks after a new sign-in, and after 30 days", async () => {
    expect(
      await ask(
        standing(),
        {},
        { ...signedIn, sessionCreatedAt: new Date("2026-11-02T08:00:00Z") },
      ),
    ).toBe(true);
    const old = new Date("2026-10-02T09:00:00Z");
    expect(
      await ask(standing({ checkedAt: old }), {}, { ...signedIn, sessionCreatedAt: null }),
    ).toBe(true);
  });

  it("asks when the profile country isn't the one checked", async () => {
    expect(await ask(standing({ checkedCountry: "GH" }))).toBe(true);
  });

  it("asks, once a day at most, when the connection moves country", async () => {
    const abroad: IpLookup = {
      ...MTN,
      evidence: { status: "ok", country: "GB", anonymizer: null },
    };
    expect(await ask(standing(), { ip: abroad })).toBe(true);
    const lastHour = new Date("2026-11-02T11:00:00Z");
    expect(await ask(standing({ checkedAt: lastHour }), { ip: abroad })).toBe(false);
  });

  it("doesn't ask because of a VPN", async () => {
    const vpn: IpLookup = {
      ...MTN,
      evidence: { status: "ok", country: "GB", anonymizer: "hosting" },
    };
    expect(await ask(standing(), { ip: vpn })).toBe(false);
  });
});

describe("LocationCheckService founders' page", () => {
  it("adds up the checks and counts who would have been stopped", async () => {
    const { service, reads } = make({ mode: "watch" });
    reads(locationCheck, [
      { purpose: "signup", decision: "approved", count: 7 },
      { purpose: "recheck", decision: "mismatch", count: 2 },
    ]);
    reads("raw", [{ reason: "gps_match", count: 7 }]);
    reads(locationCheck, [
      { decision: "approved" },
      { decision: "mismatch" },
      { decision: "skipped" },
    ]);
    const summary = await service.summary(7, now);
    expect(summary).toMatchObject({
      mode: "watch",
      days: 7,
      checks: 9,
      people: 3,
      peopleStopped: 2,
      topReasons: [{ reason: "gps_match", count: 7 }],
    });
  });

  it("lists checks with who made them", async () => {
    const { service, reads } = make();
    reads(locationCheck, [{ id: "check-1", username: "tega" }]);
    expect(await service.list({ before: null, limit: 50, decision: null })).toEqual([
      { id: "check-1", username: "tega" },
    ]);
    expect(profile).toBeDefined();
  });

  it("deletes checks older than 90 days", async () => {
    const { service, writes } = make();
    await service.purge(now);
    expect(writes).toEqual([{ op: "delete", table: locationCheck }]);
  });
});
