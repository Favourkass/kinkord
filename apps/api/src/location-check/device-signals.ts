import { getTimezone } from "countries-and-timezones";
import type { DeviceEvidence } from "./country-check-rules";

/**
 * What the browser says about itself. A web app can't see whether a phone is
 * rooted or jailbroken, or whether a fake-GPS app runs underneath the
 * browser: only store apps can (Play Integrity, App Attest), and the stores
 * don't take adult apps. Anyone determined can also send whatever they like
 * here, so these catch the everyday tools, and none of them proves anything
 * on its own.
 */
export interface DeviceReport {
  /** Intl's time zone, e.g. "Africa/Lagos". */
  timezone: string | null;
  /** navigator.webdriver. */
  automation: boolean;
  /** Whether navigator.geolocation.getCurrentPosition is the browser's own function. */
  geolocationNative: boolean;
  /** The WebGL renderer's name. */
  renderer: string | null;
}

/** Software and virtual-machine renderers, which real phones don't have. */
const EMULATED_RENDERER =
  /swiftshader|llvmpipe|softpipe|virtualbox|vmware|parallels|android emulator|bluestacks|genymotion|ldplayer/i;

export function evaluateDevice(report: DeviceReport): DeviceEvidence {
  return {
    automation: report.automation,
    locationOverridden: !report.geolocationNative,
    emulator: EMULATED_RENDERER.test(report.renderer ?? ""),
    timezoneCountries: timezoneCountries(report.timezone),
  };
}

/**
 * The countries that use a time zone. Africa/Lagos covers ten countries and
 * Africa/Accra is an old name for Africa/Abidjan's zone, so this is a set:
 * a clock that fits several countries rules none of them out. UTC and the
 * Etc zones fit nowhere in particular, so they say nothing.
 */
export function timezoneCountries(zone: string | null): string[] | null {
  if (!zone) return null;
  const countries = getTimezone(zone)?.countries ?? [];
  return countries.length > 0 ? countries : null;
}
