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

/** One check, as the API answers it. */
export interface LocationCheckPM {
  id: string;
  decision: LocationCheckDecision;
  reasons: string[];
  /** False while the check only watches: the decision was recorded, not applied. */
  enforced: boolean;
  /** Where the GPS put them, when that's one of Kinkord's countries. */
  detectedCountry: string | null;
}

/** What the member is told after a check. Only "pass" carries on. */
export type LocationCheckOutcome =
  | { kind: "pass"; checkId: string | null }
  | { kind: "mismatch"; vpn: boolean; detectedCountry: string | null }
  | { kind: "allow-location" }
  | { kind: "no-location" }
  | { kind: "no-connection" }
  | { kind: "refused" }
  | { kind: "paused" };

const VPN_REASONS = new Set(["vpn", "vpn_location", "hosting", "tor"]);

export function outcomeOf(check: LocationCheckPM): LocationCheckOutcome {
  // Watching, every result lets the member on; only the record differs.
  if (!check.enforced || check.decision === "approved" || check.decision === "travel") {
    return { kind: "pass", checkId: check.id };
  }
  switch (check.decision) {
    case "mismatch":
      return {
        kind: "mismatch",
        vpn: check.reasons.some((reason) => VPN_REASONS.has(reason)),
        detectedCountry: check.detectedCountry,
      };
    case "retry":
      if (check.reasons[0] === "gps_denied") return { kind: "allow-location" };
      if (check.reasons[0] === "ip_unavailable") return { kind: "no-connection" };
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
  userId: string | null;
  username: string | null;
  displayName: string | null;
  selectedCountry: string;
  gpsStatus: string;
  gpsCountry: string | null;
  gpsAccuracyM: number | null;
  ipCountry: string | null;
  ipNetwork: string | null;
  ipAnonymizer: "tor" | "hosting" | null;
  timezone: string | null;
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

/** Only paths inside the app may be returned to after a check. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
