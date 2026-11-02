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
    geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          status: "ok",
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        }),
      (error) =>
        resolve({
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

/** Whether a function is the browser's own, rather than one a script or extension put there. */
export function isNativeFunction(fn: unknown): boolean {
  try {
    return (
      typeof fn === "function" &&
      /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(fn))
    );
  } catch {
    return false;
  }
}

function webglRenderer(): string | null {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name: unknown = gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    return typeof name === "string" ? name.slice(0, 200) : null;
  } catch {
    return null;
  }
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
    // With no geolocation at all there's nothing to override.
    geolocationNative: nav?.geolocation
      ? isNativeFunction(nav.geolocation.getCurrentPosition)
      : true,
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

  /** Reads the GPS, then asks the API whether the member is in `country`. */
  async check(country: string): Promise<LocationCheckPM> {
    const gps = await readPosition();
    return api.post<LocationCheckPM>("/location-check", {
      country,
      gps,
      device: deviceReport(),
      deviceId: deviceId(),
    });
  },

  /** Watch mode only: "Not now". */
  skip: (country: string) =>
    api.post<LocationCheckPM>("/location-check/skip", { country, deviceId: deviceId() }),

  // The founders' page (Moderation → Location).
  summary: (days = 7) =>
    api.get<LocationCheckSummaryPM>(`/admin/location-checks/summary?days=${days}`),
  list: (opts: { before?: string | null; decision?: string | null } = {}) => {
    const query = new URLSearchParams();
    if (opts.before) query.set("before", opts.before);
    if (opts.decision) query.set("decision", opts.decision);
    const qs = query.toString();
    return api.get<LocationCheckRowPM[]>(`/admin/location-checks${qs ? `?${qs}` : ""}`);
  },
  setMode: (mode: LocationCheckMode) =>
    api.put<{ mode: LocationCheckMode }>("/admin/location-checks/mode", { mode }),
};
