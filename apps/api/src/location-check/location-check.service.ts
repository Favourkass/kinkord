import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { and, desc, eq, gt, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { networkKey } from "../auth/sign-in-limits";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  locationCheck,
  locationStatus,
  profile,
  user,
  type AccountType,
  type Anonymizer,
  type LocationCheckDecision,
  type LocationCheckPurpose,
  type LocationStanding,
} from "../db/schema";
import { AVAILABLE_COUNTRIES } from "../members/members.service";
import { isSuperAdmin } from "../moderation/admins";
import { decideCountryCheck, type CheckOutcome } from "./country-check-rules";
import { evaluateDevice, type DeviceReport } from "./device-signals";
import { cellOf, evaluateGps, impossibleTravel, type GpsReport } from "./gps-country";
import { LocationSettingsService } from "./location-settings.service";
import { NetworkIntelService } from "./network-intel.service";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A member is asked again this long after their last check. */
export const RECHECK_AFTER_MS = 30 * DAY_MS;
/** Away from home, a member may carry on this long after a check at home. */
export const TRAVEL_WINDOW_MS = 30 * DAY_MS;
/** When their connection's country changes, a member is asked again, at most this often. */
export const DRIFT_RECHECK_MS = DAY_MS;
/**
 * A new session within this long of a check needs no other: changing the
 * password or two-factor mints a session too, and isn't a new sign-in.
 */
export const SIGN_IN_GRACE_MS = 12 * HOUR_MS;
/** An approved check must be spent (on sign-up or a country change) within this. */
export const PASS_VALID_MS = 30 * 60 * 1000;
/** Checks are kept this long, then deleted. */
const KEEP_MS = 90 * DAY_MS;
/** Checks one connection may send in an hour, while joining, before it is refused outright. */
const MAX_CHECKS_PER_NETWORK_HOUR = 120;

/** Read when needed rather than at load, so an import cycle through the members module can't leave it empty. */
const served = (): string[] => AVAILABLE_COUNTRIES.map((country) => country.code);
const FAILED: LocationCheckDecision[] = ["mismatch", "refused"];
/** Whether a decision, or a standing, lets the member through. */
const passes = (decision: LocationCheckDecision | LocationStanding) =>
  decision === "approved" || decision === "travel";

/** The code the web app recognises to send a member to the location check. */
export const LOCATION_CHECK_REQUIRED = "LOCATION_CHECK_REQUIRED";
/** The code for a country change that hasn't been confirmed by a check. */
export const LOCATION_CHECK_NEEDED = "LOCATION_CHECK_NEEDED";

export interface CheckingMember {
  id: string;
  /** Their profile country; a check for any other country is for switching to it. */
  country: string | null;
}

export interface CheckRequest {
  /** Null while joining, before the account exists. */
  member: CheckingMember | null;
  country: string;
  gps: GpsReport;
  device: DeviceReport;
  deviceId: string | null;
  ip: string | null;
}

/**
 * What the member can do about a check that didn't pass. Only this goes back
 * to the app, never the signals behind it, so the answer can't be used to
 * tune a fake.
 */
export type CheckHint = "vpn" | "allow-location" | "no-location" | "no-connection" | null;

export interface CheckResult {
  id: string;
  decision: LocationCheckDecision;
  hint: CheckHint;
  /** False in watch mode: the decision was recorded, not applied. */
  enforced: boolean;
  /** Where the GPS put them, when that's one of Kinkord's countries, to offer on a mismatch. */
  detectedCountry: string | null;
}

/** A member's standing, as the auth guard reads it alongside their profile. */
export interface StandingRow {
  status: LocationStanding;
  checkedCountry: string;
  checkedAt: Date;
  ipCountry: string | null;
}

export interface DueQuery {
  user: { email: string; emailVerified: boolean };
  sessionCreatedAt: Date | null;
  ip: string | null;
  profile: { country: string | null; accountType: AccountType };
  standing: StandingRow | null;
}

/**
 * `due`: the app asks at the next page. `hold`: the API also refuses every
 * other route until they pass, which only happens while enforcing, and never
 * for a check that is merely nearly due or a connection that moved.
 */
export interface CheckDue {
  due: boolean;
  hold: boolean;
}
const NOT_DUE: CheckDue = { due: false, hold: false };

/**
 * The CTO's country check (2026-11-02): GPS, IP, VPN and device signals,
 * decided here and nowhere else. A check made while joining is spent on the
 * account it lets in; one made to switch country is spent on that switch;
 * every other check renews the member's standing (location_status), which
 * the auth guard reads.
 */
@Injectable()
export class LocationCheckService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private firstPurge?: NodeJS.Timeout;

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly intel: NetworkIntelService,
    private readonly settings: LocationSettingsService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") return;
    // Soon after start as well as daily: deploys replace instances more often
    // than once a day, so a daily timer alone might never fire.
    const purge = () => void this.purge().catch(() => undefined);
    this.firstPurge = setTimeout(purge, (1 + Math.random() * 9) * 60_000);
    this.firstPurge.unref();
    this.timer = setInterval(purge, DAY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearTimeout(this.firstPurge);
    clearInterval(this.timer);
  }

  mode() {
    return this.settings.mode();
  }

  /** A signed-in member as a check sees them: who, and which country their profile says. */
  async memberOf(userId: string): Promise<CheckingMember> {
    const [row] = await this.db
      .select({ country: profile.country })
      .from(profile)
      .where(eq(profile.userId, userId))
      .limit(1);
    return { id: userId, country: row?.country ?? null };
  }

  async check(req: CheckRequest, now = new Date()): Promise<CheckResult> {
    const mode = await this.settings.mode();
    if (mode === "off") throw new BadRequestException("Country checks are switched off.");
    const purpose = purposeOf(req);
    const network = networkKey(req.ip);
    const gps = evaluateGps(req.gps);
    const ip = this.intel.lookup(req.ip);
    const device = evaluateDevice(req.device);
    const cell = cellOf(req.gps);
    const [standing, tries] = await Promise.all([
      req.member ? this.standingOf(req.member.id) : null,
      this.recentTries(req, network, now),
      // Members are limited by their own failures; a carrier address is shared by many.
      req.member ? undefined : this.refuseFloods(network, now),
    ]);

    const outcome: CheckOutcome = decideCountryCheck({
      selected: req.country,
      purpose,
      gps,
      ip: ip.evidence,
      device,
      history: {
        ...tries,
        impossibleTravel: impossibleTravel(
          standing && { cell: standing.cell, at: standing.cellAt },
          cell,
          now,
        ),
        recentHomeCheck:
          !!standing?.approvedAt &&
          standing.checkedCountry === req.member?.country &&
          now.getTime() - standing.approvedAt.getTime() < TRAVEL_WINDOW_MS,
      },
    });

    const enforced = mode === "enforce";
    const anonymizer = ip.evidence.status === "ok" ? ip.evidence.anonymizer : null;
    const ipCountry = ip.evidence.status === "ok" ? ip.evidence.country : null;
    const [row] = await this.db
      .insert(locationCheck)
      .values({
        userId: req.member?.id ?? null,
        purpose,
        selectedCountry: req.country,
        gpsStatus: req.gps.status,
        gpsCountry: gps.status === "ok" ? gps.country : null,
        gpsAccuracyM: req.gps.status === "ok" ? roundedAccuracy(req.gps.accuracy) : null,
        ipCountry,
        ipAsn: ip.asn,
        ipNetwork: ip.network?.slice(0, 200) ?? null,
        ipAnonymizer: anonymizer,
        timezone: req.device.timezone?.slice(0, 64) ?? null,
        reasons: outcome.reasons,
        decision: outcome.decision,
        enforced,
        networkKey: network,
        deviceId: req.deviceId,
        createdAt: now,
      })
      .returning({ id: locationCheck.id });

    if (req.member) {
      await this.renewStanding(req.member, purpose, outcome.decision, enforced, now, {
        cell,
        ipCountry: baselineOf(ipCountry, anonymizer),
      });
    }
    return {
      id: row.id,
      decision: outcome.decision,
      hint: hintFor(outcome),
      enforced,
      detectedCountry:
        gps.status === "ok" && gps.country && served().includes(gps.country) ? gps.country : null,
    };
  }

  /** Watch mode only: they chose not to share their location, which is recorded as such. */
  async skip(
    req: Pick<CheckRequest, "member" | "country" | "deviceId" | "ip">,
    now = new Date(),
  ): Promise<CheckResult> {
    if ((await this.settings.mode()) !== "watch") {
      throw new BadRequestException("Share your location to continue.");
    }
    const purpose = purposeOf(req);
    const network = networkKey(req.ip);
    if (!req.member) await this.refuseFloods(network, now);
    const ip = this.intel.lookup(req.ip);
    const [row] = await this.db
      .insert(locationCheck)
      .values({
        userId: req.member?.id ?? null,
        purpose,
        selectedCountry: req.country,
        gpsStatus: "skipped",
        ipCountry: ip.evidence.status === "ok" ? ip.evidence.country : null,
        ipAsn: ip.asn,
        ipNetwork: ip.network?.slice(0, 200) ?? null,
        ipAnonymizer: ip.evidence.status === "ok" ? ip.evidence.anonymizer : null,
        reasons: ["skipped"],
        decision: "skipped",
        enforced: false,
        networkKey: network,
        deviceId: req.deviceId,
        createdAt: now,
      })
      .returning({ id: locationCheck.id });
    if (req.member) {
      await this.renewStanding(req.member, purpose, "skipped", false, now, {
        cell: null,
        ipCountry: null,
      });
    }
    return { id: row.id, decision: "skipped", hint: null, enforced: false, detectedCountry: null };
  }

  /**
   * Whether a new account may be created for `country`, spending the check
   * that allows it. Enforcing, that must be an approved check for that
   * country from the last 30 minutes; watching, any check is linked so the
   * founders' page can follow it, and none is needed.
   */
  async claimForSignup(
    id: string | null,
    country: string | null,
    now = new Date(),
  ): Promise<{ allowed: boolean; claim: SignupClaim | null }> {
    const mode = await this.settings.mode();
    if (mode === "off") return { allowed: true, claim: null };
    if (!id || !country) return { allowed: mode !== "enforce", claim: null };
    const [row] = await this.db
      .update(locationCheck)
      .set({ consumedAt: now })
      .where(
        and(
          eq(locationCheck.id, id),
          eq(locationCheck.purpose, "signup"),
          isNull(locationCheck.userId),
          isNull(locationCheck.consumedAt),
          eq(locationCheck.selectedCountry, country),
          gt(locationCheck.createdAt, new Date(now.getTime() - PASS_VALID_MS)),
          mode === "enforce" ? eq(locationCheck.decision, "approved") : undefined,
        ),
      )
      .returning({
        id: locationCheck.id,
        decision: locationCheck.decision,
        ipCountry: locationCheck.ipCountry,
        ipAnonymizer: locationCheck.ipAnonymizer,
      });
    if (!row) return { allowed: mode !== "enforce", claim: null };
    return {
      allowed: true,
      claim: {
        id: row.id,
        decision: row.decision,
        country,
        ipCountry: baselineOf(row.ipCountry, row.ipAnonymizer),
      },
    };
  }

  /** Sign-up failed after its check was spent: make it usable again. */
  async releaseSignupClaim(claim: SignupClaim): Promise<void> {
    await this.db
      .update(locationCheck)
      .set({ consumedAt: null })
      .where(and(eq(locationCheck.id, claim.id), isNull(locationCheck.userId)));
  }

  /** The account exists: the check that let it in becomes theirs, and so does the standing it earned. */
  async attachSignupClaim(claim: SignupClaim, userId: string, now = new Date()): Promise<void> {
    await this.db.update(locationCheck).set({ userId }).where(eq(locationCheck.id, claim.id));
    await this.writeStanding(
      userId,
      standingFor(claim.decision, claim.country, claim.ipCountry, now),
    );
  }

  /**
   * Whether a member may switch their profile to `country`, spending the
   * check that confirms it: "claimed" when a check backs the switch (their
   * standing moves with it), "free" when none is needed, "missing" when
   * enforcing without one. Enforcing, only an approved check for that country
   * from the last 30 minutes counts; watching, any recent one is recorded, so
   * the member isn't asked twice. Founders and organisations need none. Call
   * it only once the rest of the change is known to be valid: it spends the
   * check.
   */
  async authorizeCountryChange(
    userId: string,
    country: string | null,
    now = new Date(),
  ): Promise<"free" | "claimed" | "missing"> {
    const mode = await this.settings.mode();
    if (mode === "off") return "free";
    if (await this.exempt(userId)) return "free";
    const enforcing = mode === "enforce";
    // Clearing the country would lift Nigeria's limits as surely as a new one.
    if (!country) return enforcing ? "missing" : "free";
    const [candidate] = await this.db
      .select({
        id: locationCheck.id,
        decision: locationCheck.decision,
        ipCountry: locationCheck.ipCountry,
        ipAnonymizer: locationCheck.ipAnonymizer,
      })
      .from(locationCheck)
      .where(
        and(
          eq(locationCheck.userId, userId),
          eq(locationCheck.purpose, "change"),
          eq(locationCheck.selectedCountry, country),
          enforcing ? eq(locationCheck.decision, "approved") : undefined,
          isNull(locationCheck.consumedAt),
          gt(locationCheck.createdAt, new Date(now.getTime() - PASS_VALID_MS)),
        ),
      )
      .orderBy(desc(locationCheck.createdAt))
      .limit(1);
    if (!candidate) return enforcing ? "missing" : "free";
    const [spent] = await this.db
      .update(locationCheck)
      .set({ consumedAt: now })
      .where(and(eq(locationCheck.id, candidate.id), isNull(locationCheck.consumedAt)))
      .returning({ id: locationCheck.id });
    if (!spent) return enforcing ? "missing" : "free";
    await this.writeStanding(
      userId,
      standingFor(
        candidate.decision,
        country,
        baselineOf(candidate.ipCountry, candidate.ipAnonymizer),
        now,
      ),
    );
    return "claimed";
  }

  /**
   * Whether this member owes a country check (`due`), and whether the API
   * should hold them until they pass it (`hold`, enforcing only):
   * - they have no passing check for their profile country: due and held
   * - this session started after their last check, more than 12 hours on (a
   *   new sign-in), or the check is over 30 days old: due and held
   * - the check is a day from expiring, or their connection is in a country
   *   that is neither their profile's nor the one their last check accepted,
   *   at most once a day: due, never held, so nobody is pulled off a page
   *   mid-message
   * Founders and organisations are never asked.
   */
  async checkDue(q: DueQuery, now = new Date()): Promise<CheckDue> {
    const mode = await this.settings.mode();
    if (mode === "off") return NOT_DUE;
    if (isSuperAdmin(q.user) || q.profile.accountType === "organization") return NOT_DUE;
    const enforcing = mode === "enforce";
    const s = q.standing;
    if (!s) return { due: true, hold: enforcing };
    const passing = passes(s.status) || (!enforcing && s.status === "observed");
    const age = now.getTime() - s.checkedAt.getTime();
    const newSignIn =
      q.sessionCreatedAt !== null && s.checkedAt < q.sessionCreatedAt && age > SIGN_IN_GRACE_MS;
    if (!passing || s.checkedCountry !== q.profile.country || newSignIn || age > RECHECK_AFTER_MS) {
      return { due: true, hold: enforcing };
    }
    if (age > RECHECK_AFTER_MS - DAY_MS) return { due: true, hold: false };
    if (age > DRIFT_RECHECK_MS) {
      const ip = this.intel.lookup(q.ip).evidence;
      if (
        ip.status === "ok" &&
        !ip.anonymizer &&
        ip.country !== q.profile.country &&
        ip.country !== s.ipCountry
      ) {
        return { due: true, hold: false };
      }
    }
    return NOT_DUE;
  }

  /** `checkDue` for a signed-in member, reading their profile and standing (GET /location-check/due). */
  async dueFor(
    who: { id: string; email: string; emailVerified: boolean },
    sessionCreatedAt: Date | null,
    ip: string | null,
    now = new Date(),
  ): Promise<CheckDue> {
    if ((await this.settings.mode()) === "off") return NOT_DUE;
    const [row] = await this.db
      .select({
        country: profile.country,
        accountType: profile.accountType,
        ...standingColumns,
      })
      .from(profile)
      .leftJoin(locationStatus, eq(locationStatus.userId, profile.userId))
      .where(eq(profile.userId, who.id))
      .limit(1);
    if (!row) return NOT_DUE;
    return this.checkDue(
      {
        user: who,
        sessionCreatedAt,
        ip,
        profile: { country: row.country, accountType: row.accountType },
        standing: standingFrom(row),
      },
      now,
    );
  }

  /** The founders' page: how the checks went over the last `days` days. */
  async summary(days: number, now = new Date()) {
    const since = new Date(now.getTime() - days * DAY_MS);
    const inWindow = gt(locationCheck.createdAt, since);
    const person = sql<string>`coalesce(${locationCheck.userId}, ${locationCheck.deviceId}, ${locationCheck.networkKey}, ${locationCheck.id}::text)`;
    const latest = this.db
      .selectDistinctOn([person], { decision: locationCheck.decision })
      .from(locationCheck)
      .where(inWindow)
      .orderBy(person, desc(locationCheck.createdAt))
      .as("latest");
    const [counts, reasons, [people]] = await Promise.all([
      this.db
        .select({
          purpose: locationCheck.purpose,
          decision: locationCheck.decision,
          count: sql<number>`count(*)::int`,
        })
        .from(locationCheck)
        .where(inWindow)
        .groupBy(locationCheck.purpose, locationCheck.decision),
      this.db
        .select({
          reason: sql<string>`reason`,
          count: sql<number>`count(*)::int`,
        })
        .from(sql`${locationCheck}, unnest(${locationCheck.reasons}) as reason`)
        .where(inWindow)
        .groupBy(sql`reason`)
        .orderBy(sql`count(*) desc`)
        .limit(12),
      // Counted in the database: one row back, however many people checked.
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          stopped: sql<number>`(count(*) filter (where ${latest.decision} not in ('approved', 'travel')))::int`,
        })
        .from(latest),
    ]);
    return {
      mode: await this.settings.mode(),
      days,
      checks: counts.reduce((sum, row) => sum + row.count, 0),
      counts,
      topReasons: reasons,
      people: people?.total ?? 0,
      /** People whose latest check wouldn't let them through if the check were enforcing. */
      peopleStopped: people?.stopped ?? 0,
      data: this.intel.status(),
    };
  }

  /** The latest checks, newest first, for the founders' page. */
  async list(opts: { before: Date | null; limit: number; decision: LocationCheckDecision | null }) {
    const where: SQL[] = [];
    if (opts.before) where.push(lt(locationCheck.createdAt, opts.before));
    if (opts.decision) where.push(eq(locationCheck.decision, opts.decision));
    return this.db
      .select({
        id: locationCheck.id,
        createdAt: locationCheck.createdAt,
        purpose: locationCheck.purpose,
        username: user.username,
        selectedCountry: locationCheck.selectedCountry,
        gpsStatus: locationCheck.gpsStatus,
        gpsCountry: locationCheck.gpsCountry,
        gpsAccuracyM: locationCheck.gpsAccuracyM,
        ipCountry: locationCheck.ipCountry,
        ipNetwork: locationCheck.ipNetwork,
        ipAnonymizer: locationCheck.ipAnonymizer,
        reasons: locationCheck.reasons,
        decision: locationCheck.decision,
        enforced: locationCheck.enforced,
      })
      .from(locationCheck)
      .leftJoin(user, eq(user.id, locationCheck.userId))
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(locationCheck.createdAt))
      .limit(opts.limit);
  }

  /** Checks older than 90 days are deleted. */
  async purge(now = new Date()): Promise<void> {
    await this.db
      .delete(locationCheck)
      .where(lt(locationCheck.createdAt, new Date(now.getTime() - KEEP_MS)));
  }

  private async standingOf(userId: string) {
    const [row] = await this.db
      .select()
      .from(locationStatus)
      .where(eq(locationStatus.userId, userId))
      .limit(1);
    return row ?? null;
  }

  private async exempt(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({
        email: user.email,
        emailVerified: user.emailVerified,
        accountType: profile.accountType,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    return !!row && (isSuperAdmin(row) || row.accountType === "organization");
  }

  /**
   * Failed tries and countries tried in the last day, by member or device.
   * Without either there is no one to count against: a network address is
   * shared by many people, so it only has its own, far higher, limit.
   */
  private async recentTries(req: CheckRequest, network: string | null, now: Date) {
    const since = gt(locationCheck.createdAt, new Date(now.getTime() - DAY_MS));
    const scope = req.member
      ? eq(locationCheck.userId, req.member.id)
      : req.deviceId
        ? eq(locationCheck.deviceId, req.deviceId)
        : null;
    const [mine, [fromNetwork]] = await Promise.all([
      scope
        ? this.db
            .select({ decision: locationCheck.decision, country: locationCheck.selectedCountry })
            .from(locationCheck)
            .where(and(scope, since))
        : [],
      // Only for people joining: one member's failures must never pause another's checks.
      network && !req.member
        ? this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(locationCheck)
            .where(
              and(
                eq(locationCheck.networkKey, network),
                since,
                inArray(locationCheck.decision, FAILED),
              ),
            )
        : [{ count: 0 }],
    ]);
    return {
      failures: mine.filter((row) => FAILED.includes(row.decision)).length,
      networkFailures: fromNetwork?.count ?? 0,
      countries: new Set([...mine.map((row) => row.country), req.country]).size,
    };
  }

  private async refuseFloods(network: string | null, now: Date): Promise<void> {
    if (!network) return;
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(locationCheck)
      .where(
        and(
          eq(locationCheck.networkKey, network),
          gt(locationCheck.createdAt, new Date(now.getTime() - HOUR_MS)),
        ),
      );
    if ((row?.count ?? 0) >= MAX_CHECKS_PER_NETWORK_HOUR) {
      throw new HttpException(
        "Too many checks from this connection. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * A recheck in their own country renews the standing: approved or
   * travelling, or (watching) whatever it found. A check to switch country
   * leaves it alone until the switch is made. Where they were (the GPS cell,
   * and the connection's country) is only kept from checks that passed, so a
   * refused reading can't become the next check's starting point.
   */
  private async renewStanding(
    member: CheckingMember,
    purpose: LocationCheckPurpose,
    decision: LocationCheckDecision,
    enforced: boolean,
    now: Date,
    seen: { cell: string | null; ipCountry: string | null },
  ): Promise<void> {
    const passed = passes(decision);
    const where = passed
      ? { ipCountry: seen.ipCountry, ...(seen.cell ? { cell: seen.cell, cellAt: now } : {}) }
      : {};
    if (purpose === "recheck" && member.country && (passed || !enforced)) {
      await this.writeStanding(member.id, {
        checkedAt: now,
        checkedCountry: member.country,
        status: passed ? (decision as LocationStanding) : "observed",
        ...(decision === "approved" ? { approvedAt: now } : {}),
        ...where,
      });
      return;
    }
    if (passed && seen.cell) {
      await this.db
        .update(locationStatus)
        .set({ cell: seen.cell, cellAt: now })
        .where(eq(locationStatus.userId, member.id));
    }
  }

  private async writeStanding(
    userId: string,
    values: Omit<typeof locationStatus.$inferInsert, "userId">,
  ): Promise<void> {
    await this.db
      .insert(locationStatus)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: locationStatus.userId, set: values });
  }
}

export interface SignupClaim {
  id: string;
  decision: LocationCheckDecision;
  country: string;
  /** The connection's country on that check, when it wasn't a VPN or the like. */
  ipCountry: string | null;
}

/** The standing columns the auth guard reads alongside the profile. */
export const standingColumns = {
  standingStatus: locationStatus.status,
  standingCountry: locationStatus.checkedCountry,
  standingAt: locationStatus.checkedAt,
  standingIpCountry: locationStatus.ipCountry,
};

export function standingFrom(row: {
  standingStatus: LocationStanding | null;
  standingCountry: string | null;
  standingAt: Date | null;
  standingIpCountry: string | null;
}): StandingRow | null {
  if (!row.standingStatus || !row.standingCountry || !row.standingAt) return null;
  return {
    status: row.standingStatus,
    checkedCountry: row.standingCountry,
    checkedAt: row.standingAt,
    ipCountry: row.standingIpCountry,
  };
}

/**
 * The standing a spent check earns in `country`. It replaces whatever came
 * before, including the time of the last approval, so an approval in one
 * country never lets a member travel as if they'd been checked in another.
 */
function standingFor(
  decision: LocationCheckDecision,
  country: string,
  ipCountry: string | null,
  now: Date,
): Omit<typeof locationStatus.$inferInsert, "userId"> {
  const approved = decision === "approved";
  return {
    checkedAt: now,
    checkedCountry: country,
    status: approved ? "approved" : "observed",
    approvedAt: approved ? now : null,
    ipCountry: approved ? ipCountry : null,
    cell: null,
    cellAt: null,
  };
}

/** The connection country worth remembering: a VPN's says nothing about the member. */
function baselineOf(country: string | null, anonymizer: Anonymizer | null): string | null {
  return anonymizer ? null : country;
}

function hintFor(outcome: CheckOutcome): CheckHint {
  const [why] = outcome.reasons;
  switch (outcome.decision) {
    case "mismatch":
      return why === "vpn" || why === "vpn_location" ? "vpn" : null;
    case "retry":
      if (why === "gps_denied") return "allow-location";
      if (why === "ip_unavailable") return "no-connection";
      return "no-location";
    default:
      return null;
  }
}

function purposeOf(req: Pick<CheckRequest, "member" | "country">): LocationCheckPurpose {
  if (!req.member) return "signup";
  return req.member.country === req.country ? "recheck" : "change";
}

function roundedAccuracy(accuracy: number): number | null {
  if (!Number.isFinite(accuracy)) return null;
  return Math.min(Math.max(Math.round(accuracy), 0), 10_000_000);
}
