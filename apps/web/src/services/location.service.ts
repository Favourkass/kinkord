/**
 * Nigerian states, Kenyan counties and the places within each. The names ship
 * with the app; a state's places (thousands, for some) are fetched from
 * /locations the first time it is picked, then kept for the session. Both are
 * built from GeoNames by scripts/build-location-files.mjs.
 */
import locationStates from "@/constants/location-states.json";

const STATES: Record<string, readonly string[]> = locationStates;

export function statesForCountry(code: string): string[] {
  return [...(STATES[code.toUpperCase()] ?? [])];
}

export function isKnownState(code: string, state: string | null | undefined): boolean {
  return Boolean(state) && (STATES[code.toUpperCase()] ?? []).includes(state ?? "");
}

/** The file a state's places live in: "Akwa Ibom" → "akwa-ibom". Mirrors the generator. */
export function locationSlug(state: string): string {
  return state
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘'`]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const loaded = new Map<string, Promise<string[]>>();

/**
 * Regions, cities and towns within a state or county, sorted. Empty for a state
 * we have no list for, or when the list can't be fetched (asked again next time).
 */
export function regionsForState(code: string, state: string): Promise<string[]> {
  const country = code.toUpperCase();
  if (!isKnownState(country, state)) return Promise.resolve([]);
  const path = `/locations/${country}/${locationSlug(state)}.json`;
  const cached = loaded.get(path);
  if (cached) return cached;
  const request = fetch(path)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((body: unknown) =>
      Array.isArray(body) ? body.filter((x): x is string => typeof x === "string") : [],
    )
    .catch(() => {
      loaded.delete(path);
      return [];
    });
  loaded.set(path, request);
  return request;
}
