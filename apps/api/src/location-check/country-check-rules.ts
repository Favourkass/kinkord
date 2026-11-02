import type { Anonymizer, LocationCheckDecision, LocationCheckPurpose } from "../db/schema";

/** Failed checks (mismatch or refused) a member or device may have in a day before checks pause. */
export const MAX_FAILURES_PER_DAY = 5;
/**
 * The same, counted per network address. Mobile networks put thousands of
 * people behind one address, so this is far higher: it only stops one
 * connection hammering the check, never a whole carrier.
 */
export const MAX_NETWORK_FAILURES_PER_DAY = 40;
/** Different countries one member or device may try in a day. */
export const MAX_COUNTRIES_PER_DAY = 3;

export type GpsEvidence =
  | { status: "denied" | "unavailable" | "timeout" | "unsupported" }
  | {
      status: "ok";
      /** The country the reading falls in; null at sea or off the map. */
      country: string | null;
      /** Other countries within the reading's accuracy, so a border town still matches. */
      nearby: readonly string[];
      /** Estimated from the network rather than satellites or Wi-Fi (worse than 5 km). */
      coarse: boolean;
      /** Why the reading can't be real, when it can't. */
      implausible: string | null;
    };

export type IpEvidence =
  { status: "unavailable" } | { status: "ok"; country: string; anonymizer: Anonymizer | null };

export interface DeviceEvidence {
  /** The browser says it is driven by automation (navigator.webdriver). */
  automation: boolean;
  /** The page's geolocation function isn't the browser's own: an extension or script is answering. */
  locationOverridden: boolean;
  /** The graphics renderer is a software or virtual-machine one. Recorded, never decisive. */
  emulator: boolean;
  /** The countries that use the device clock's zone; null when unknown. */
  timezoneCountries: readonly string[] | null;
}

export interface CheckHistory {
  /** Failed checks in the last day, for this member or this device. */
  failures: number;
  /** Failed checks in the last day from this network address. */
  networkFailures: number;
  /** Different countries chosen in the last day, this one included. */
  countries: number;
  /** The GPS moved faster than a plane since their last precise reading. */
  impossibleTravel: boolean;
  /** Passed a check in their own profile country within the travel window. */
  recentHomeCheck: boolean;
}

export interface CheckInput {
  /** The country they say they are in, ISO 3166-1 alpha-2. */
  selected: string;
  purpose: LocationCheckPurpose;
  /** The countries Kinkord serves; abroad outside them, a member may travel. */
  served: readonly string[];
  gps: GpsEvidence;
  ip: IpEvidence;
  device: DeviceEvidence;
  history: CheckHistory;
}

export interface CheckOutcome {
  decision: Exclude<LocationCheckDecision, "skipped">;
  /** Short codes: the one that decided first, then every other signal worth recording. */
  reasons: string[];
}

/**
 * The CTO's country rule (2026-11-02), decided on the server only:
 *
 * - Both the GPS and the connection must be read. If either can't be, the
 *   member retries; a failed read never counts as a match.
 * - The GPS matching the chosen country is enough, and so is the connection
 *   matching, even when the other disagrees.
 * - Neither matching blocks, and the member is asked to choose the country
 *   they are physically in.
 *
 * What counts as evidence:
 * - A connection through a VPN, proxy, Tor or a hosting network says where
 *   that service is, not where the member is. Its country is never a match,
 *   or any VPN would get through. On its own, though, it never blocks
 *   someone whose GPS matches.
 * - A network-estimated position (worse than 5 km) on such a connection may
 *   only echo the VPN's location back, so it is no match either.
 * - When the GPS and the device clock agree on one other country, they
 *   outweigh a connection that alone points at the chosen one. When the
 *   connection and the clock agree on one other country, they outweigh a
 *   GPS that alone does.
 * - Clear signs of faking refuse the attempt (founder, 2026-11-02): a
 *   browser driven by automation, a page whose geolocation is answered by a
 *   script, a reading no device could give, or impossible travel. These are
 *   signals, not proof, so the member may try again.
 * - Members abroad outside Kinkord's countries, soon after a check at home,
 *   carry on as travellers with their home country (and its rules)
 *   unchanged. Never when joining: an account starts where its owner is.
 */
export function decideCountryCheck(input: CheckInput): CheckOutcome {
  const { selected, gps, ip, device, history } = input;
  const signals = signalsOf(input);
  const decide = (decision: CheckOutcome["decision"], ...why: string[]): CheckOutcome => ({
    decision,
    reasons: [...new Set([...why, ...signals])],
  });

  if (history.countries > MAX_COUNTRIES_PER_DAY) return decide("paused", "too_many_countries");
  if (
    history.failures >= MAX_FAILURES_PER_DAY ||
    history.networkFailures >= MAX_NETWORK_FAILURES_PER_DAY
  ) {
    return decide("paused", "too_many_failures");
  }

  const faking = [
    device.automation ? "automation" : null,
    device.locationOverridden ? "location_overridden" : null,
    gps.status === "ok" ? gps.implausible : null,
    history.impossibleTravel ? "impossible_travel" : null,
  ].filter((reason): reason is string => reason !== null);
  if (faking.length > 0) return decide("refused", ...faking);

  if (gps.status !== "ok") return decide("retry", `gps_${gps.status}`);
  if (gps.country === null && gps.nearby.length === 0) return decide("retry", "gps_no_country");
  if (ip.status !== "ok") return decide("retry", "ip_unavailable");

  const zone = device.timezoneCountries;
  const anonymized = ip.anonymizer !== null;
  const gpsMatch = gps.country === selected || gps.nearby.includes(selected);
  const gpsEchoesVpn = anonymized && gps.coarse;
  const gpsContradicted =
    gpsMatch &&
    !anonymized &&
    ip.country !== selected &&
    zone !== null &&
    zone.includes(ip.country) &&
    !zone.includes(selected);
  const deviceElsewhere =
    !gpsMatch &&
    gps.country !== null &&
    zone !== null &&
    zone.includes(gps.country) &&
    !zone.includes(selected);

  if (gpsMatch && !gpsEchoesVpn && !gpsContradicted) return decide("approved", "gps_match");
  if (!anonymized && ip.country === selected && !deviceElsewhere) {
    return decide("approved", "ip_match");
  }

  const served = (code: string) => input.served.includes(code);
  const abroad =
    gps.country !== null &&
    !served(gps.country) &&
    !gpsEchoesVpn &&
    (anonymized || !served(ip.country) || ip.country === selected);
  if (input.purpose === "recheck" && history.recentHomeCheck && abroad) {
    return decide("travel", "abroad");
  }

  if (gpsEchoesVpn) return decide("mismatch", "vpn_location");
  if (gpsContradicted) return decide("mismatch", "gps_contradicted");
  if (anonymized && ip.country === selected) return decide("mismatch", "vpn");
  if (deviceElsewhere) return decide("mismatch", "device_elsewhere");
  return decide("mismatch", "elsewhere");
}

/** Everything noticed along the way, recorded with every decision for the founders' page. */
function signalsOf({ selected, gps, ip, device }: CheckInput): string[] {
  const signals: string[] = [];
  if (ip.status === "ok") {
    if (ip.anonymizer) signals.push(ip.anonymizer);
    if (ip.country !== selected) signals.push("ip_elsewhere");
  }
  if (gps.status === "ok") {
    if (gps.coarse) signals.push("gps_coarse");
    if (gps.country !== null && gps.country !== selected && !gps.nearby.includes(selected)) {
      signals.push("gps_elsewhere");
    }
  }
  if (device.emulator) signals.push("emulator");
  if (device.timezoneCountries && !device.timezoneCountries.includes(selected)) {
    signals.push("timezone_elsewhere");
  }
  return signals;
}
