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
/** Abroad outside Kinkord's countries, a member may carry on this long after a check at home. */
export const TRAVEL_WINDOW_MS = 30 * DAY_MS;
/** When their connection's country changes, a member is asked again, at most this often. */
export const DRIFT_RECHECK_MS = DAY_MS;
/** An approved check must be spent (on sign-up or a country change) within this. */
export const PASS_VALID_MS = 30 * 60 * 1000;
/** Checks are kept this long, then deleted. */
const KEEP_MS = 90 * DAY_MS;
/** Checks one connection may send in an hour before it is refused outright. */
const MAX_CHECKS_PER_NETWORK_HOUR = 120;

/** Read when needed rather than at load, so an import cycle through the members module can't leave it empty. */
const served = (): string[] => AVAILABLE_COUNTRIES.map((country) => country.code);
const FAILED: LocationCheckDecision[] = ["mismatch", "refused"];

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

export interface CheckResult {
  id: string;
  decision: LocationCheckDecision;
  reasons: string[];
  /** False in watch mode: the decision was recorded, not applied. */
  enforced: boolean;
  /** Where the GPS put them, when that's one of Kinkord's countries, to offer on a mismatch. */
  detectedCountry: string | null;
}

export interface HoldQuery {
  user: { id: string; email: string; emailVerified: boolean };
  sessionCreatedAt: Date | null;
  ip: string | null;
  profile: { country: string | null; accountType: AccountType };
}

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

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly intel: NetworkIntelService,
    private readonly settings: LocationSettingsService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.purge().catch(() => undefined), DAY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
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
    await this.refuseFloods(network, now);

    const gps = evaluateGps(req.gps);
    const ip = this.intel.lookup(req.ip);
    const device = evaluateDevice(req.device);
    const standing = req.member ? await this.standingOf(req.member.id) : null;
    const cell = gps.status === "ok" && !gps.implausible ? cellOf(req.gps) : null;
    const tries = await this.recentTries(req, network, now);

    const outcome: CheckOutcome = decideCountryCheck({
      selected: req.country,
      purpose,
      served: served(),
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
    const [row] = await this.db
      .insert(locationCheck)
      .values({
        userId: req.member?.id ?? null,
        purpose,
        selectedCountry: req.country,
        gpsStatus: req.gps.status,
        gpsCountry: gps.status === "ok" ? gps.country : null,
        gpsAccuracyM: req.gps.status === "ok" ? roundedAccuracy(req.gps.accuracy) : null,
        ipCountry: ip.evidence.status === "ok" ? ip.evidence.country : null,
        ipAsn: ip.asn,
        ipNetwork: ip.network?.slice(0, 200) ?? null,
        ipAnonymizer: ip.evidence.status === "ok" ? ip.evidence.anonymizer : null,
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
      await this.renewStanding(req.member, purpose, outcome.decision, enforced, cell, now);
    }
    return {
      id: row.id,
      decision: outcome.decision,
      reasons: outcome.reasons,
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
    await this.refuseFloods(network, now);
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
    if (req.member) await this.renewStanding(req.member, purpose, "skipped", false, null, now);
    return {
      id: row.id,
      decision: "skipped",
      reasons: ["skipped"],
      enforced: false,
      detectedCountry: null,
    };
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
      .returning({ id: locationCheck.id, decision: locationCheck.decision });
    if (!row) return { allowed: mode !== "enforce", claim: null };
    return { allowed: true, claim: { id: row.id, decision: row.decision, country } };
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
    const approved = claim.decision === "approved";
    await this.writeStanding(userId, {
      checkedAt: now,
      checkedCountry: claim.country,
      status: approved ? "approved" : "observed",
      ...(approved ? { approvedAt: now } : {}),
    });
  }

  /**
   * Whether a member may switch their profile to `country`, spending the
   * check that confirms it: "claimed" when a check backs the switch (its
   * standing moves with it), "free" when none is needed, "missing" when
   * enforcing without one. Enforcing, only an approved check for that
   * country from the last 30 minutes counts; watching, any recent one is
   * recorded, so the member isn't asked twice. Founders and organisations
   * need none.
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
      .select({ id: locationCheck.id, decision: locationCheck.decision })
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
    const approved = candidate.decision === "approved";
    await this.writeStanding(userId, {
      checkedAt: now,
      checkedCountry: country,
      status: approved ? "approved" : "observed",
      ...(approved ? { approvedAt: now } : {}),
    });
    return "claimed";
  }

  /**
   * Whether the auth guard should hold this member at the location check:
   * - they have never passed one for their profile country
   * - this session started after their last check (a new sign-in)
   * - their last check is over 30 days old
   * - their connection is in another country, and they haven't checked in a day
   * Founders and organisations are never held.
   */
  async needsCheck(q: HoldQuery, now = new Date()): Promise<boolean> {
    const mode = await this.settings.mode();
    if (mode === "off") return false;
    if (isSuperAdmin(q.user) || q.profile.accountType === "organization") return false;
    const standing = await this.standingOf(q.user.id);
    if (!standing) return true;
    const passing: LocationStanding[] =
      mode === "enforce" ? ["approved", "travel"] : ["approved", "travel", "observed"];
    if (!passing.includes(standing.status)) return true;
    if (standing.checkedCountry !== q.profile.country) return true;
    const checkedAt = standing.checkedAt.getTime();
    if (q.sessionCreatedAt && checkedAt < q.sessionCreatedAt.getTime()) return true;
    if (now.getTime() - checkedAt > RECHECK_AFTER_MS) return true;
    if (now.getTime() - checkedAt > DRIFT_RECHECK_MS) {
      const ip = this.intel.lookup(q.ip).evidence;
      if (ip.status === "ok" && !ip.anonymizer && ip.country !== q.profile.country) return true;
    }
    return false;
  }

  /** The founders' page: how the checks went over the last `days` days. */
  async summary(days: number, now = new Date()) {
    const since = new Date(now.getTime() - days * DAY_MS);
    const inWindow = gt(locationCheck.createdAt, since);
    const person = sql<string>`coalesce(${locationCheck.userId}, ${locationCheck.deviceId}, ${locationCheck.networkKey}, ${locationCheck.id}::text)`;
    const [counts, reasons, latest] = await Promise.all([
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
      this.db
        .selectDistinctOn([person], { decision: locationCheck.decision })
        .from(locationCheck)
        .where(inWindow)
        .orderBy(person, desc(locationCheck.createdAt)),
    ]);
    const lastDecisions = latest.map((r) => r.decision);
    return {
      mode: await this.settings.mode(),
      days,
      checks: counts.reduce((sum, row) => sum + row.count, 0),
      counts,
      topReasons: reasons,
      people: lastDecisions.length,
      /** People whose latest check wouldn't let them through if the check were enforcing. */
      peopleStopped: lastDecisions.filter((d) => d !== "approved" && d !== "travel").length,
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
        userId: locationCheck.userId,
        username: user.username,
        displayName: profile.displayName,
        selectedCountry: locationCheck.selectedCountry,
        gpsStatus: locationCheck.gpsStatus,
        gpsCountry: locationCheck.gpsCountry,
        gpsAccuracyM: locationCheck.gpsAccuracyM,
        ipCountry: locationCheck.ipCountry,
        ipNetwork: locationCheck.ipNetwork,
        ipAnonymizer: locationCheck.ipAnonymizer,
        timezone: locationCheck.timezone,
        reasons: locationCheck.reasons,
        decision: locationCheck.decision,
        enforced: locationCheck.enforced,
      })
      .from(locationCheck)
      .leftJoin(user, eq(user.id, locationCheck.userId))
      .leftJoin(profile, eq(profile.userId, locationCheck.userId))
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

  /** Failed tries and countries tried in the last day, by member, else device, else network. */
  private async recentTries(req: CheckRequest, network: string | null, now: Date) {
    const since = gt(locationCheck.createdAt, new Date(now.getTime() - DAY_MS));
    const scope = req.member
      ? eq(locationCheck.userId, req.member.id)
      : req.deviceId
        ? eq(locationCheck.deviceId, req.deviceId)
        : network
          ? eq(locationCheck.networkKey, network)
          : null;
    const mine = scope
      ? await this.db
          .select({ decision: locationCheck.decision, country: locationCheck.selectedCountry })
          .from(locationCheck)
          .where(and(scope, since))
      : [];
    const [fromNetwork] = network
      ? await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(locationCheck)
          .where(
            and(
              eq(locationCheck.networkKey, network),
              since,
              inArray(locationCheck.decision, FAILED),
            ),
          )
      : [{ count: 0 }];
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
   * leaves it alone until the switch is made; only the GPS cell moves.
   */
  private async renewStanding(
    member: CheckingMember,
    purpose: LocationCheckPurpose,
    decision: LocationCheckDecision,
    enforced: boolean,
    cell: string | null,
    now: Date,
  ): Promise<void> {
    const moved = cell ? { cell, cellAt: now } : {};
    if (purpose === "recheck" && member.country) {
      const status: LocationStanding | null =
        decision === "approved"
          ? "approved"
          : decision === "travel"
            ? "travel"
            : enforced
              ? null
              : "observed";
      if (status) {
        await this.writeStanding(member.id, {
          checkedAt: now,
          checkedCountry: member.country,
          status,
          ...(status === "approved" ? { approvedAt: now } : {}),
          ...moved,
        });
        return;
      }
    }
    if (cell) {
      await this.db.update(locationStatus).set(moved).where(eq(locationStatus.userId, member.id));
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
}

function purposeOf(req: Pick<CheckRequest, "member" | "country">): LocationCheckPurpose {
  if (!req.member) return "signup";
  return req.member.country === req.country ? "recheck" : "change";
}

function roundedAccuracy(accuracy: number): number | null {
  if (!Number.isFinite(accuracy)) return null;
  return Math.min(Math.max(Math.round(accuracy), 0), 10_000_000);
}
