import { iso1A2Code } from "@rapideditor/country-coder";
import type { GpsEvidence } from "./country-check-rules";

/** What the browser reported: a position, or why there is none. */
export type GpsReport =
  | { status: "ok"; lat: number; lng: number; accuracy: number }
  | { status: "denied" | "unavailable" | "timeout" | "unsupported" };

/** Worse than this, the position came from the network, not satellites or Wi-Fi. */
export const COARSE_ACCURACY_M = 5_000;
/** Borders in the offline map are simplified, so even a precise reading looks this far around it. */
const MIN_BORDER_RADIUS_M = 2_000;
/** A reading this vague says little about which side of a border it is on; look no further. */
const MAX_BORDER_RADIUS_M = 25_000;
const METERS_PER_DEGREE = 111_320;
const BEARINGS = 8;

/**
 * The country a reading falls in, worked out on our own server from an
 * offline map of borders, so no map service ever sees where a member is.
 * The coordinates go no further than this function: only countries, the
 * accuracy and a 0.1° cell come out.
 */
export function evaluateGps(report: GpsReport): GpsEvidence {
  if (report.status !== "ok") return { status: report.status };
  const { lat, lng, accuracy } = report;
  const implausible = implausibleReading(lat, lng, accuracy);
  if (implausible) return { status: "ok", country: null, nearby: [], coarse: false, implausible };

  const country = countryAt(lat, lng);
  const radius = Math.min(Math.max(accuracy, MIN_BORDER_RADIUS_M), MAX_BORDER_RADIUS_M);
  const nearby = new Set<string>();
  for (let i = 0; i < BEARINGS; i += 1) {
    const bearing = (2 * Math.PI * i) / BEARINGS;
    const dLat = (radius * Math.cos(bearing)) / METERS_PER_DEGREE;
    const dLng =
      (radius * Math.sin(bearing)) /
      (METERS_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
    const code = countryAt(lat + dLat, lng + dLng);
    if (code && code !== country) nearby.add(code);
  }
  return {
    status: "ok",
    country,
    nearby: [...nearby],
    coarse: accuracy > COARSE_ACCURACY_M,
    implausible: null,
  };
}

/** Readings no phone or browser gives: off the globe, a zero or negative accuracy, or exactly 0,0. */
function implausibleReading(lat: number, lng: number, accuracy: number): string | null {
  if (![lat, lng, accuracy].every(Number.isFinite)) return "gps_not_a_number";
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return "gps_out_of_range";
  if (accuracy <= 0) return "gps_perfect_accuracy";
  if (lat === 0 && lng === 0) return "gps_null_island";
  return null;
}

function countryAt(lat: number, lng: number): string | null {
  return iso1A2Code([lng, lat]) ?? null;
}

/** The reading rounded to 0.1° (about 11 km): all that is kept, and only of precise readings. */
export function cellOf(report: GpsReport): string | null {
  if (report.status !== "ok" || report.accuracy > COARSE_ACCURACY_M) return null;
  if (implausibleReading(report.lat, report.lng, report.accuracy)) return null;
  return `${report.lat.toFixed(1)},${report.lng.toFixed(1)}`;
}

/** Faster than an airliner, over a distance the 0.1° rounding can't explain. */
const MAX_SPEED_KMH = 1_000;
const MIN_JUMP_KM = 500;
/** Readings further apart than this are too old to compare. */
const TRAVEL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Whether getting from one cell to the other in the time between them needs a plane faster than any. */
export function impossibleTravel(
  previous: { cell: string | null; at: Date | null } | null,
  next: string | null,
  now: Date,
): boolean {
  if (!previous?.cell || !previous.at || !next) return false;
  const elapsed = now.getTime() - previous.at.getTime();
  if (elapsed < 0 || elapsed > TRAVEL_WINDOW_MS) return false;
  const km = distanceKm(parseCell(previous.cell), parseCell(next));
  if (km < MIN_JUMP_KM) return false;
  const hours = Math.max(elapsed / 3_600_000, 1 / 60);
  return km / hours > MAX_SPEED_KMH;
}

function parseCell(cell: string): [number, number] {
  const [lat, lng] = cell.split(",").map(Number);
  return [lat, lng];
}

/** Great-circle distance between two [lat, lng] points. */
function distanceKm([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}
