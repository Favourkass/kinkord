import { afterEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, HttpException } from "@nestjs/common";
import { type Db } from "../db/db.module";
import { locationCheck, locationStatus, profile, user } from "../db/schema";
import {
  LocationCheckService,
  PASS_VALID_MS,
  standingFrom,
  type CheckRequest,
  type DueQuery,
} from "./location-check.service";
import { type LocationCheckMode, type LocationSettingsService } from "./location-settings.service";
import { type IpLookup, type NetworkIntelService } from "./network-intel.service";

/**
 * A stand-in for drizzle that answers each query from a queue per table and
 * records every write. Selects take from `reads`, `.returning()` from
 * `returns`. Raw-SQL sources read from "raw", subqueries from "subquery".
 */
function fakeDb() {
  const reads = new Map<unknown, unknown[][]>();
  const returns = new Map<unknown, unknown[][]>();
  const writes: Array<{ op: "insert" | "update" | "delete"; table: unknown; values?: unknown }> =
    [];
  const take = (queues: Map<unknown, unknown[][]>, table: unknown) =>
    queues.get(table)?.shift() ?? [];
  const SUBQUERY = { decision: "decision", __subquery: true };

  const selectChain = () => {
    let table: unknown;
    const chain: Record<string, unknown> = {};
    for (const step of ["where", "limit", "orderBy", "leftJoin", "groupBy"]) {
      chain[step] = () => chain;
    }
    chain.from = (t: unknown) => {
      table =
        t === SUBQUERY
          ? "subquery"
          : typeof t === "object" && t !== null && "queryChunks" in t
            ? "raw"
            : t;
      return chain;
    };
    chain.as = () => SUBQUERY;
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
  it("records a check while joining, without the coordinates, and says only what to do", async () => {
    const { service, reads, returns, written } = make();
    reads(locationCheck, []);
    returns(locationCheck, [{ id: "check-1" }]);
    const result = await service.check(joining, now);
    expect(result).toEqual({
      id: "check-1",
      decision: "approved",
      hint: null,
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
      reasons: ["gps_match"],
      decision: "approved",
      enforced: true,
      deviceId: "device-1234",
    });
    expect(JSON.stringify(row)).not.toMatch(/6\.52|3\.37/);
    expect(written("insert", locationStatus)).toEqual([]);
  });

  it("tells a VPN user to turn it off, and a refused location to allow it", async () => {
    const vpn = make({
      ip: { ...MTN, evidence: { status: "ok", country: "US", anonymizer: "hosting" } },
    });
    vpn.reads(locationCheck, []);
    vpn.returns(locationCheck, [{ id: "c" }]);
    expect(await vpn.service.check({ ...joining, country: "US" }, now)).toMatchObject({
      decision: "mismatch",
      hint: "vpn",
    });
    const denied = make();
    denied.reads(locationCheck, []);
    denied.returns(locationCheck, [{ id: "d" }]);
    expect(
      await denied.service.check({ ...joining, gps: { status: "denied" } }, now),
    ).toMatchObject({ decision: "retry", hint: "allow-location" });
  });

  it("refuses to run while switched off", async () => {
    const { service } = make({ mode: "off" });
    await expect(service.check(joining, now)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("renews a member's standing when a recheck at home passes, with where they were", async () => {
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
        ipCountry: "NG",
        cell: "6.5,3.4",
        cellAt: now,
      },
    ]);
  });

  it("only watching, lets a failed recheck through as observed, keeping nothing of where it was", async () => {
    const { service, reads, returns, written } = make({ mode: "watch" });
    reads(locationStatus, []);
    reads(locationCheck, []);
    returns(locationCheck, [{ id: "check-3" }]);
    // GPS and clock in London outweigh the Nigerian connection.
    const result = await service.check(
      {
        ...joining,
        member,
        gps: { status: "ok", lat: 51.5, lng: -0.12, accuracy: 20 },
        device: { ...lagosPhone, timezone: "Europe/London" },
      },
      now,
    );
    expect(result).toMatchObject({ decision: "mismatch", enforced: false });
    expect(written("insert", locationStatus)).toEqual([
      { userId: "u1", checkedAt: now, checkedCountry: "NG", status: "observed" },
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

  it("never moves the stored position to a refused reading", async () => {
    const { service, reads, returns, written } = make({
      ip: { ...MTN, evidence: { status: "ok", country: "ZA", anonymizer: "hosting" } },
    });
    // An hour ago they were in Lagos; now the reading says Johannesburg.
    reads(locationStatus, [
      {
        cell: "6.5,3.4",
        cellAt: new Date(now.getTime() - 3_600_000),
        approvedAt: null,
        checkedCountry: "NG",
      },
    ]);
    reads(locationCheck, []);
    returns(locationCheck, [{ id: "check-11" }]);
    const result = await service.check(
      {
        ...joining,
        member,
        country: "ZA",
        gps: { status: "ok", lat: -26.2, lng: 28.05, accuracy: 10 },
      },
      now,
    );
    expect(result.decision).toBe("refused");
    expect(written("update", locationStatus)).toEqual([]);
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
    expect(result).toMatchObject({ decision: "paused" });
  });

  it("never pauses a member for failures from other people on their network", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    const { service, reads, returns } = make();
    reads(locationStatus, []);
    reads(locationCheck, []); // the member's own tries: none
    returns(locationCheck, [{ id: "check-10" }]);
    const result = await service.check({ ...joining, member }, now);
    expect(result.decision).toBe("approved");
  });

  it("without a device id, counts nobody's tries against a visitor but the network's", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    const { service, reads, returns } = make();
    // Read order: the network's failures today, then its checks this hour.
    reads(locationCheck, [{ count: 3 }], [{ count: 10 }]);
    returns(locationCheck, [{ id: "check-12" }]);
    const result = await service.check({ ...joining, deviceId: null }, now);
    expect(result.decision).toBe("approved");
  });

  it("refuses a connection sending checks by the hundred", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    const { service, reads } = make();
    reads(locationCheck, [], [{ count: 0 }], [{ count: 120 }]);
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
    expect(await service.claimForSignup(null, "NG", now)).toEqual({
      allowed: false,
      claim: null,
    });
    expect(await service.claimForSignup("check-1", "NG", now)).toEqual({
      allowed: false,
      claim: null,
    });
  });

  it("enforcing, spends an approved check on the sign-up", async () => {
    const { service, returns, written } = make();
    returns(locationCheck, [
      { id: "check-1", decision: "approved", ipCountry: "NG", ipAnonymizer: null },
    ]);
    expect(await service.claimForSignup("check-1", "NG", now)).toEqual({
      allowed: true,
      claim: { id: "check-1", decision: "approved", country: "NG", ipCountry: "NG" },
    });
    expect(written("update", locationCheck)).toEqual([{ consumedAt: now }]);
  });

  it("watching, lets anyone join and links whatever check there was", async () => {
    const { service, returns } = make({ mode: "watch" });
    expect(await service.claimForSignup(null, "NG", now)).toEqual({ allowed: true, claim: null });
    returns(locationCheck, [
      { id: "check-2", decision: "mismatch", ipCountry: "US", ipAnonymizer: "hosting" },
    ]);
    expect(await service.claimForSignup("check-2", "NG", now)).toMatchObject({
      allowed: true,
      claim: { id: "check-2", ipCountry: null },
    });
  });

  it("gives the new account the standing its check earned", async () => {
    const { service, written } = make();
    await service.attachSignupClaim(
      { id: "check-1", decision: "approved", country: "NG", ipCountry: "NG" },
      "u1",
      now,
    );
    expect(written("update", locationCheck)).toEqual([{ userId: "u1" }]);
    expect(written("insert", locationStatus)).toEqual([
      {
        userId: "u1",
        checkedAt: now,
        checkedCountry: "NG",
        status: "approved",
        approvedAt: now,
        ipCountry: "NG",
        cell: null,
        cellAt: null,
      },
    ]);
  });

  it("only observes a member who joined on a failed check while watching", async () => {
    const { service, written } = make({ mode: "watch" });
    await service.attachSignupClaim(
      { id: "check-2", decision: "retry", country: "NG", ipCountry: null },
      "u1",
      now,
    );
    expect(written("insert", locationStatus)[0]).toMatchObject({
      status: "observed",
      approvedAt: null,
    });
  });

  it("makes a released check usable again", async () => {
    const { service, written } = make();
    await service.releaseSignupClaim({
      id: "check-1",
      decision: "approved",
      country: "NG",
      ipCountry: "NG",
    });
    expect(written("update", locationCheck)).toEqual([{ consumedAt: null }]);
  });

  it("keeps a pass for half an hour", () => {
    expect(PASS_VALID_MS).toBe(30 * 60 * 1000);
  });
});

describe("LocationCheckService.authorizeCountryChange", () => {
  const person = { email: "member@kinkord.com", emailVerified: true, accountType: "person" };

  it("is free while switched off, or watching with no check to record", async () => {
    expect(await make({ mode: "off" }).service.authorizeCountryChange("u1", "GH", now)).toBe(
      "free",
    );
    const watching = make({ mode: "watch" });
    watching.reads(user, [person]);
    watching.reads(locationCheck, []);
    expect(await watching.service.authorizeCountryChange("u1", "GH", now)).toBe("free");
  });

  it("watching, records the check behind a switch, and forgets the old country's approval", async () => {
    const { service, reads, returns, written } = make({ mode: "watch" });
    reads(user, [person]);
    reads(locationCheck, [
      { id: "check-8", decision: "mismatch", ipCountry: "GB", ipAnonymizer: null },
    ]);
    returns(locationCheck, [{ id: "check-8" }]);
    expect(await service.authorizeCountryChange("u1", "GH", now)).toBe("claimed");
    expect(written("insert", locationStatus)).toEqual([
      {
        userId: "u1",
        checkedAt: now,
        checkedCountry: "GH",
        status: "observed",
        approvedAt: null,
        ipCountry: null,
        cell: null,
        cellAt: null,
      },
    ]);
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
    reads(locationCheck, [
      { id: "check-9", decision: "approved", ipCountry: "GH", ipAnonymizer: null },
    ]);
    returns(locationCheck, [{ id: "check-9" }]);
    expect(await service.authorizeCountryChange("u1", "GH", now)).toBe("claimed");
    expect(written("insert", locationStatus)[0]).toMatchObject({
      checkedCountry: "GH",
      status: "approved",
      approvedAt: now,
      ipCountry: "GH",
    });
  });

  it("won't spend a check twice", async () => {
    const { service, reads, returns } = make();
    reads(user, [person]);
    reads(locationCheck, [
      { id: "check-9", decision: "approved", ipCountry: "GH", ipAnonymizer: null },
    ]);
    returns(locationCheck, []);
    expect(await service.authorizeCountryChange("u1", "GH", now)).toBe("missing");
  });
});

describe("LocationCheckService.checkDue", () => {
  const standing = (change: Partial<NonNullable<DueQuery["standing"]>> = {}) => ({
    status: "approved" as const,
    checkedCountry: "NG",
    checkedAt: new Date("2026-11-01T09:00:00Z"),
    ipCountry: "NG",
    ...change,
  });
  const signedIn = (change: Partial<DueQuery> = {}): DueQuery => ({
    user: { email: "member@kinkord.com", emailVerified: true },
    sessionCreatedAt: new Date("2026-10-30T09:00:00Z"),
    ip: "102.89.32.1",
    profile: { country: "NG", accountType: "person" },
    standing: standing(),
    ...change,
  });
  const due = (q: DueQuery, opts: { mode?: LocationCheckMode; ip?: IpLookup } = {}) =>
    make(opts).service.checkDue(q, now);
  const NO = { due: false, hold: false };

  it("never asks while switched off, nor founders or organisations", async () => {
    expect(await due(signedIn({ standing: null }), { mode: "off" })).toEqual(NO);
    expect(
      await due(
        signedIn({
          standing: null,
          user: { email: "maxihandsome@gmail.com", emailVerified: true },
        }),
      ),
    ).toEqual(NO);
    expect(
      await due(
        signedIn({ standing: null, profile: { country: "NG", accountType: "organization" } }),
      ),
    ).toEqual(NO);
  });

  it("enforcing, holds a member who has never checked; watching, only asks", async () => {
    expect(await due(signedIn({ standing: null }))).toEqual({ due: true, hold: true });
    expect(await due(signedIn({ standing: null }), { mode: "watch" })).toEqual({
      due: true,
      hold: false,
    });
  });

  it("lets a member with a recent check at home through", async () => {
    expect(await due(signedIn())).toEqual(NO);
  });

  it("enforcing, holds again after a check that was only observed", async () => {
    const observed = signedIn({ standing: standing({ status: "observed" }) });
    expect(await due(observed)).toEqual({ due: true, hold: true });
    expect(await due(observed, { mode: "watch" })).toEqual(NO);
  });

  it("asks after a new sign-in, but not within 12 hours of a check", async () => {
    const later = new Date("2026-11-02T08:00:00Z");
    expect(await due(signedIn({ sessionCreatedAt: later }))).toEqual({ due: true, hold: true });
    // A password change an hour after the check mints a session too.
    const soon = signedIn({
      standing: standing({ checkedAt: new Date("2026-11-02T10:00:00Z") }),
      sessionCreatedAt: new Date("2026-11-02T11:00:00Z"),
    });
    expect(await due(soon)).toEqual(NO);
  });

  it("holds after 30 days, and only asks the day before", async () => {
    const old = signedIn({
      standing: standing({ checkedAt: new Date("2026-10-02T09:00:00Z") }),
      sessionCreatedAt: null,
    });
    expect(await due(old)).toEqual({ due: true, hold: true });
    const nearly = signedIn({
      standing: standing({ checkedAt: new Date("2026-10-03T18:00:00Z") }),
      sessionCreatedAt: null,
    });
    expect(await due(nearly)).toEqual({ due: true, hold: false });
  });

  it("holds when the profile country isn't the one checked", async () => {
    expect(await due(signedIn({ standing: standing({ checkedCountry: "GH" }) }))).toEqual({
      due: true,
      hold: true,
    });
  });

  it("asks, never holds, when the connection moves country, at most once a day", async () => {
    const abroad: IpLookup = {
      ...MTN,
      evidence: { status: "ok", country: "GB", anonymizer: null },
    };
    expect(await due(signedIn(), { ip: abroad })).toEqual({ due: true, hold: false });
    const lastHour = signedIn({
      standing: standing({ checkedAt: new Date("2026-11-02T11:00:00Z") }),
      sessionCreatedAt: null,
    });
    expect(await due(lastHour, { ip: abroad })).toEqual(NO);
  });

  it("doesn't ask because of a VPN, or a network that always looked that way", async () => {
    const vpn: IpLookup = {
      ...MTN,
      evidence: { status: "ok", country: "GB", anonymizer: "hosting" },
    };
    expect(await due(signedIn(), { ip: vpn })).toEqual(NO);
    // An office gateway that exits in South Africa, accepted on their last check.
    const gateway: IpLookup = {
      ...MTN,
      evidence: { status: "ok", country: "ZA", anonymizer: null },
    };
    expect(
      await due(signedIn({ standing: standing({ ipCountry: "ZA" }) }), { ip: gateway }),
    ).toEqual(NO);
  });

  it("reads a signed-in member's profile and standing for the app", async () => {
    const { service, reads } = make();
    reads(profile, [
      {
        country: "NG",
        accountType: "person",
        standingStatus: null,
        standingCountry: null,
        standingAt: null,
        standingIpCountry: null,
      },
    ]);
    expect(
      await service.dueFor(
        { id: "u1", email: "member@kinkord.com", emailVerified: true },
        null,
        null,
        now,
      ),
    ).toEqual({ due: true, hold: true });
  });

  it("builds a standing only from a whole row", () => {
    expect(
      standingFrom({
        standingStatus: "approved",
        standingCountry: "NG",
        standingAt: now,
        standingIpCountry: null,
      }),
    ).toEqual({ status: "approved", checkedCountry: "NG", checkedAt: now, ipCountry: null });
    expect(
      standingFrom({
        standingStatus: null,
        standingCountry: null,
        standingAt: null,
        standingIpCountry: null,
      }),
    ).toBeNull();
  });
});

describe("LocationCheckService founders' page", () => {
  it("adds up the checks and counts, in the database, who would have been stopped", async () => {
    const { service, reads } = make({ mode: "watch" });
    reads(locationCheck, [
      { purpose: "signup", decision: "approved", count: 7 },
      { purpose: "recheck", decision: "mismatch", count: 2 },
    ]);
    reads("raw", [{ reason: "gps_match", count: 7 }]);
    reads("subquery", [{ total: 3, stopped: 2 }]);
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
  });

  it("deletes checks older than 90 days", async () => {
    const { service, writes } = make();
    await service.purge(now);
    expect(writes).toEqual([{ op: "delete", table: locationCheck }]);
  });
});
