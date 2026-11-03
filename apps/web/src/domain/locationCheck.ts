/**
 * The country check (CTO, 2026-11-02): the app sends the GPS reading and the
 * browser's own signals; the API alone decides. See
 * apps/api/src/location-check.
 */

/** off: no checks. watch: recorded, never stops anyone. enforce: decisions apply. */
export type LocationCheckMode = "off" | "watch" | "enforce";

export type LocationCheckDecision =
  "approved" | "travel" | "mismatch" | "retry" | "refused" | "paused" | "skipped";

export type GpsReportPM =
  | { status: "ok"; lat: number; lng: number; accuracy: number }
  | { status: "denied" | "unavailable" | "timeout" | "unsupported" };

export interface DeviceReportPM {
  timezone: string | null;
  automation: boolean;
  geolocationNative: boolean;
  renderer: string | null;
}

/** What the member can do about a check that didn't pass; the API never says why. */
export type LocationCheckHint = "vpn" | "allow-location" | "no-location" | "no-connection" | null;

/** One check, as the API answers it. */
export interface LocationCheckPM {
  id: string;
  decision: LocationCheckDecision;
  hint: LocationCheckHint;
  /** False while the check only watches: the decision was recorded, not applied. */
  enforced: boolean;
  /** Where the GPS put them, when that's one of Kinkord's countries. */
  detectedCountry: string | null;
}

/** The `code` the API sends when a member's country check is due (auth guard hold). */
export const LOCATION_CHECK_REQUIRED = "LOCATION_CHECK_REQUIRED";
/** The `code` the API sends for a country switch no check has confirmed. */
export const LOCATION_CHECK_NEEDED = "LOCATION_CHECK_NEEDED";

const codeOf = (body: unknown): string | undefined =>
  (body as { code?: unknown } | null)?.code as string | undefined;
export const isLocationCheckRequired = (body: unknown) => codeOf(body) === LOCATION_CHECK_REQUIRED;
export const isLocationCheckNeeded = (body: unknown) => codeOf(body) === LOCATION_CHECK_NEEDED;

/** Whether a decision lets the member through: approved, or travelling. */
export const isPassing = (decision: LocationCheckDecision): boolean =>
  decision === "approved" || decision === "travel";

/** What the member is told after a check. Only "pass" carries on. */
export type LocationCheckOutcome =
  | { kind: "pass"; checkId: string | null }
  | { kind: "mismatch"; vpn: boolean; detectedCountry: string | null }
  | { kind: "allow-location" }
  | { kind: "no-location" }
  | { kind: "no-connection" }
  | { kind: "refused" }
  | { kind: "paused" }
  /** The connection sent too many checks this hour; it clears within the hour. */
  | { kind: "busy" }
  /** "Not now" refused: the check no longer only watches. */
  | { kind: "share-needed" };

export function outcomeOf(check: LocationCheckPM): LocationCheckOutcome {
  // Watching, every result lets the member on; only the record differs.
  if (!check.enforced || isPassing(check.decision)) {
    return { kind: "pass", checkId: check.id };
  }
  switch (check.decision) {
    case "mismatch":
      return {
        kind: "mismatch",
        vpn: check.hint === "vpn",
        detectedCountry: check.detectedCountry,
      };
    case "retry":
      if (check.hint === "allow-location") return { kind: "allow-location" };
      if (check.hint === "no-connection") return { kind: "no-connection" };
      return { kind: "no-location" };
    case "refused":
      return { kind: "refused" };
    case "paused":
      return { kind: "paused" };
    default:
      return { kind: "pass", checkId: check.id };
  }
}

/** The founders' page: how the checks went over a window of days. */
export interface LocationCheckSummaryPM {
  mode: LocationCheckMode;
  days: number;
  checks: number;
  counts: Array<{
    purpose: "signup" | "recheck" | "change";
    decision: LocationCheckDecision;
    count: number;
  }>;
  topReasons: Array<{ reason: string; count: number }>;
  people: number;
  peopleStopped: number;
  data: {
    countryDataBuiltAt: string | null;
    networkDataBuiltAt: string | null;
    torExits: number;
    torUpdatedAt: string | null;
  };
}

export interface LocationCheckRowPM {
  id: string;
  createdAt: string;
  purpose: "signup" | "recheck" | "change";
  username: string | null;
  selectedCountry: string;
  gpsStatus: string;
  gpsCountry: string | null;
  gpsAccuracyM: number | null;
  ipCountry: string | null;
  ipNetwork: string | null;
  ipAnonymizer: "tor" | "hosting" | null;
  reasons: string[];
  decision: LocationCheckDecision;
  enforced: boolean;
}

/** A decision counted, whatever the purpose. */
export function countByDecision(
  counts: LocationCheckSummaryPM["counts"],
): Record<LocationCheckDecision, number> {
  const totals: Record<LocationCheckDecision, number> = {
    approved: 0,
    travel: 0,
    mismatch: 0,
    retry: 0,
    refused: 0,
    paused: 0,
    skipped: 0,
  };
  for (const row of counts) totals[row.decision] += row.count;
  return totals;
}

/** "102 m", "4.2 km": a reading's accuracy, as moderators read it. */
export function accuracyLabel(meters: number | null): string | null {
  if (meters === null) return null;
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

const SAME_SITE = "https://kinkord.invalid";

/**
 * Only paths inside the app may be returned to after a check. Parsed as a
 * browser would, so tricks like "/\t/evil.example" (tabs and newlines are
 * dropped by URL parsers) can't lead off the site.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, SAME_SITE);
    if (url.origin !== SAME_SITE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Pages the app never interrupts for a check: signed-out pages, sign-up, and the check itself. */
const CHECK_FREE = [
  "/signup",
  "/login",
  "/location-check",
  "/privacy",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/about",
  "/contact",
  "/invest",
  "/kinkopedia",
  "/lectures",
  "/admin",
];

export function isCheckFreePath(pathname: string): boolean {
  return (
    pathname === "/" ||
    CHECK_FREE.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}
