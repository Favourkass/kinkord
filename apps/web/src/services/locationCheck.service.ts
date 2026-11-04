import type {
  DeviceReportPM,
  GpsReportPM,
  LocationCheckMode,
  LocationCheckPM,
  LocationCheckRowPM,
  LocationCheckSummaryPM,
} from "@/domain/locationCheck";
import { api } from "./apiClient";

/** How long to wait for a fix before telling the member we couldn't get one. */
const GPS_TIMEOUT_MS = 20_000;
/**
 * The browser's own timeout doesn't count the time a permission prompt waits
 * for an answer, and a prompt closed without one (Firefox allows that) never
 * answers at all, so the wait is capped here too.
 */
const PROMPT_TIMEOUT_MS = 60_000;
const DEVICE_ID_KEY = "kinkord_device_id";
const DEVICE_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * The browser's position, asked fresh (never a cached one). The coordinates
 * go to Kinkord's API only, which turns them into a country and keeps nothing
 * finer than that.
 */
export function readPosition(
  geolocation: Geolocation | undefined = globalThis.navigator?.geolocation,
): Promise<GpsReportPM> {
  if (!geolocation) return Promise.resolve({ status: "unsupported" });
  return new Promise((resolve) => {
    const unanswered = setTimeout(() => resolve({ status: "timeout" }), PROMPT_TIMEOUT_MS);
    const answer = (report: GpsReportPM) => {
      clearTimeout(unanswered);
      resolve(report);
    };
    geolocation.getCurrentPosition(
      ({ coords }) =>
        answer({
          status: "ok",
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        }),
      (error) =>
        answer({
          status:
            error.code === error.PERMISSION_DENIED
              ? "denied"
              : error.code === error.TIMEOUT
                ? "timeout"
                : "unavailable",
        }),
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
    );
  });
}

/**
 * Whether a function is the browser's own, rather than one a script or
 * extension put there. A bound function also prints as native code, but is
 * named "bound …"; an override set on the object itself shows as its own
 * property. A determined faker can still get past this: it's one signal.
 */
export function isNativeFunction(fn: unknown, name?: string): boolean {
  try {
    return (
      typeof fn === "function" &&
      (name === undefined || fn.name === name) &&
      /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(fn))
    );
  } catch {
    return false;
  }
}

function geolocationIsNative(geolocation: Geolocation | undefined): boolean {
  // With no geolocation at all there's nothing to override.
  if (!geolocation) return true;
  try {
    return (
      Object.getOwnPropertyNames(geolocation).length === 0 &&
      isNativeFunction(geolocation.getCurrentPosition, "getCurrentPosition")
    );
  } catch {
    return false;
  }
}

let renderer: string | null | undefined;

/** The graphics renderer's name, read once per page and the context let go straight after. */
function webglRenderer(): string | null {
  if (renderer !== undefined) return renderer;
  renderer = null;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return renderer;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name: unknown = gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    renderer = typeof name === "string" ? name.slice(0, 200) : null;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    renderer = null;
  }
  return renderer;
}

/** What the browser says about itself: signals for the API, never proof on their own. */
export function deviceReport(nav: Navigator | undefined = globalThis.navigator): DeviceReportPM {
  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timezone = null;
  }
  return {
    timezone,
    automation: nav?.webdriver === true,
    geolocationNative: geolocationIsNative(nav?.geolocation),
    renderer: webglRenderer(),
  };
}

/** A random id this browser keeps, so tries from one phone count together. */
export function deviceId(): string | null {
  try {
    const kept = localStorage.getItem(DEVICE_ID_KEY);
    if (kept && DEVICE_ID.test(kept)) return kept;
    const made = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, made);
    return made;
  } catch {
    return null;
  }
}

export const locationCheckService = {
  mode: () => api.get<{ mode: LocationCheckMode }>("/location-check/mode").then((r) => r.mode),

  /**
   * Reads the GPS, then asks the API whether the member is in `country`.
   * `joining`: a check for a new account, whoever the browser is still signed in as.
   */
  async check(country: string, opts: { joining?: boolean } = {}): Promise<LocationCheckPM> {
    const gps = await readPosition();
    return api.post<LocationCheckPM>("/location-check", {
      country,
      joining: opts.joining ?? false,
      gps,
      device: deviceReport(),
      deviceId: deviceId(),
    });
  },

  /** Watch mode only: "Not now". */
  skip: (country: string, opts: { joining?: boolean } = {}) =>
    api.post<LocationCheckPM>("/location-check/skip", {
      country,
      joining: opts.joining ?? false,
      deviceId: deviceId(),
    }),

  /** Whether the signed-in member owes a check; the app asks at the next page when they do. */
  due: () => api.get<{ due: boolean }>("/location-check/due").then((r) => r.due),

  // The founders' page (Moderation → Location).
  summary: (days = 7) =>
    api.get<LocationCheckSummaryPM>(`/admin/location-checks/summary?days=${days}`),
  list: (opts: { before?: string | null; decision?: string | null; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (opts.limit) query.set("limit", String(opts.limit));
    if (opts.before) query.set("before", opts.before);
    if (opts.decision) query.set("decision", opts.decision);
    const qs = query.toString();
    return api.get<LocationCheckRowPM[]>(`/admin/location-checks${qs ? `?${qs}` : ""}`);
  },
  setMode: (mode: LocationCheckMode) =>
    api.put<{ mode: LocationCheckMode }>("/admin/location-checks/mode", { mode }),
};
