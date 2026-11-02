import { join } from "node:path";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import maxmind, { type AsnResponse, type CountryResponse, type Reader } from "maxmind";
import type { Anonymizer } from "../db/schema";
import type { IpEvidence } from "./country-check-rules";
import { isHostingNetwork } from "./hosting-networks";

/** Tor's own list of exit relays, refreshed hourly; no key needed. */
const TOR_EXIT_LIST = "https://check.torproject.org/torbulkexitlist";
const TOR_REFRESH_MS = 60 * 60 * 1000;

/**
 * DB-IP's free country and network files (CC BY 4.0, credited on the privacy
 * page), fetched when the API image is built (scripts/fetch-ip-data.mjs).
 */
const DATA_DIR = process.env.LOCATION_DATA_DIR ?? join(process.cwd(), "data", "ip");
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
  private timer?: NodeJS.Timeout;

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    try {
      this.country = await maxmind.open<CountryResponse>(join(DATA_DIR, COUNTRY_FILE));
      this.asn = await maxmind.open<AsnResponse>(join(DATA_DIR, ASN_FILE));
    } catch (error) {
      this.log.warn(
        `IP data missing from ${DATA_DIR}; country checks will ask members to retry (${String(error)})`,
      );
    }
    void this.refreshTor();
    this.timer = setInterval(() => void this.refreshTor(), TOR_REFRESH_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
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
