import { tmpdir } from "node:os";
import { join } from "node:path";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import maxmind, { type AsnResponse, type CountryResponse, type Reader } from "maxmind";
import type { Anonymizer } from "../db/schema";
import type { IpEvidence } from "./country-check-rules";
import { isHostingNetwork } from "./hosting-networks";
import { fetchIpData } from "./ip-data";

/** Tor's own list of exit relays, refreshed hourly; no key needed. */
const TOR_EXIT_LIST = "https://check.torproject.org/torbulkexitlist";
const HOUR_MS = 60 * 60 * 1000;
const TOR_REFRESH_MS = HOUR_MS;
/** How often to see whether the IP data needs fetching. */
const DATA_CHECK_MS = 6 * HOUR_MS;
/** IP data older than this is fetched afresh; DB-IP publishes monthly. */
const DATA_STALE_MS = 40 * 24 * HOUR_MS;

/**
 * DB-IP's free country and network files (CC BY 4.0, credited on the privacy
 * page), fetched when the API image is built (scripts/fetch-ip-data.mjs). An
 * image built while DB-IP was unreachable comes without them; the API then
 * fetches them itself, into a temporary folder.
 */
const BUILT_DIR = process.env.LOCATION_DATA_DIR ?? join(process.cwd(), "data", "ip");
const FETCHED_DIR = join(tmpdir(), "kinkord-ip-data");
const COUNTRY_FILE = "dbip-country-lite.mmdb";
const ASN_FILE = "dbip-asn-lite.mmdb";

export interface IpLookup {
  evidence: IpEvidence;
  asn: number | null;
  /** Who runs the network, e.g. "MTN NIGERIA Communication limited". */
  network: string | null;
}

export interface IpSources {
  country: Pick<Reader<CountryResponse>, "get"> | null;
  asn: Pick<Reader<AsnResponse>, "get"> | null;
  tor: ReadonlySet<string>;
}

/** What the IP data says about one address; unavailable when the address or the data is missing. */
export function lookupIn(sources: IpSources, ip: string | null): IpLookup {
  const none: IpLookup = { evidence: { status: "unavailable" }, asn: null, network: null };
  if (!ip || !sources.country || !maxmind.validate(ip)) return none;
  let country: string | undefined;
  let asn: AsnResponse | null = null;
  try {
    country = sources.country.get(ip)?.country?.iso_code;
    asn = sources.asn?.get(ip) ?? null;
  } catch {
    return none;
  }
  if (!country) return none;
  const number = asn?.autonomous_system_number ?? null;
  const network = asn?.autonomous_system_organization ?? null;
  const anonymizer: Anonymizer | null = sources.tor.has(ip)
    ? "tor"
    : isHostingNetwork(number, network)
      ? "hosting"
      : null;
  return { evidence: { status: "ok", country, anonymizer }, asn: number, network };
}

/**
 * Where a connection comes from, worked out on our own server: no other
 * company sees members' addresses (founder, 2026-11-02). Missing data makes
 * every lookup "unavailable", which asks members to retry rather than
 * letting anyone through.
 */
@Injectable()
export class NetworkIntelService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(NetworkIntelService.name);
  private country: Reader<CountryResponse> | null = null;
  private asn: Reader<AsnResponse> | null = null;
  private tor: ReadonlySet<string> = new Set();
  private torUpdatedAt: Date | null = null;
  private fetching = false;
  private readonly timers: NodeJS.Timeout[] = [];

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    await this.load(BUILT_DIR);
    void this.refreshData();
    void this.refreshTor();
    this.timers.push(
      setInterval(() => void this.refreshTor(), TOR_REFRESH_MS),
      setInterval(() => void this.refreshData(), DATA_CHECK_MS),
    );
    for (const timer of this.timers) timer.unref();
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearInterval(timer);
  }

  lookup(ip: string | null): IpLookup {
    return lookupIn({ country: this.country, asn: this.asn, tor: this.tor }, ip);
  }

  /** How fresh the data is, for the founders' page. */
  status() {
    return {
      countryDataBuiltAt: this.country?.metadata.buildEpoch.toISOString() ?? null,
      networkDataBuiltAt: this.asn?.metadata.buildEpoch.toISOString() ?? null,
      torExits: this.tor.size,
      torUpdatedAt: this.torUpdatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Opens each file on its own, keeping the one already open when a file
   * can't be read, and says which is missing: without the network file,
   * VPNs and hosting go undetected.
   */
  private async load(dir: string): Promise<void> {
    try {
      this.country = await maxmind.open<CountryResponse>(join(dir, COUNTRY_FILE));
    } catch (error) {
      this.log.warn(`IP country data not loaded from ${dir}: ${String(error)}`);
    }
    try {
      this.asn = await maxmind.open<AsnResponse>(join(dir, ASN_FILE));
    } catch (error) {
      this.log.warn(
        `IP network data not loaded from ${dir}; VPN detection is off: ${String(error)}`,
      );
    }
  }

  /** Fetches the data when it's missing or over 40 days old, keeping the old copy if that fails. */
  private async refreshData(now = Date.now()): Promise<void> {
    const builtAt = (reader: { metadata: { buildEpoch: Date } } | null) =>
      reader?.metadata.buildEpoch.getTime() ?? 0;
    const fresh = (reader: { metadata: { buildEpoch: Date } } | null) =>
      now - builtAt(reader) < DATA_STALE_MS;
    if ((fresh(this.country) && fresh(this.asn)) || this.fetching) return;
    this.fetching = true;
    try {
      await fetchIpData(FETCHED_DIR, { log: (line) => this.log.log(line) });
      await this.load(FETCHED_DIR);
    } catch (error) {
      this.log.warn(`IP data not fetched; trying again in 6 hours: ${String(error)}`);
    } finally {
      this.fetching = false;
    }
  }

  private async refreshTor(): Promise<void> {
    try {
      const res = await fetch(TOR_EXIT_LIST, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const exits = (await res.text())
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => maxmind.validate(line));
      if (exits.length === 0) throw new Error("empty list");
      this.tor = new Set(exits);
      this.torUpdatedAt = new Date();
    } catch (error) {
      // The last good list stays in use; Tor is one signal among several.
      this.log.warn(`Tor exit list not refreshed: ${String(error)}`);
    }
  }
}
