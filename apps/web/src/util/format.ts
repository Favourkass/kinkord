/** Pure display formatters for the members / profile surfaces. */

/** 980 -> "980", 1234 -> "1.2K", 12400 -> "12.4K", 1_250_000 -> "1.3M". */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.trunc(n));
  const unit = n >= 999_950 ? { v: 1e6, s: "M" } : { v: 1e3, s: "K" };
  const val = n / unit.v;
  const text = val >= 100 ? String(Math.round(val)) : String(Math.round(val * 10) / 10);
  return `${text}${unit.s}`;
}

/** "Delta" -> "Delta State"; leaves "FCT Abuja" and already-suffixed names alone. */
export function displayState(state: string | null | undefined): string {
  const s = (state ?? "").trim();
  if (!s) return "";
  if (/\bstate$/i.test(s) || /^FCT\b/i.test(s)) return s;
  return `${s} State`;
}

/** ISO date/timestamp -> "March 2023"; null when missing or unparseable. */
export function monthYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * ISO 3166-1 alpha-2 -> English display name via Intl, with a small fallback
 * table for environments without region display names. Unknown codes pass through.
 */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(key)) return key;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(key);
    if (name && name !== key) return name;
  } catch {
    // fall through to the table
  }
  return FALLBACK_COUNTRY_NAMES[key] ?? key;
}

const FALLBACK_COUNTRY_NAMES: Record<string, string> = { NG: "Nigeria" };

/** ISO 3166-1 alpha-2 -> regional-indicator flag emoji ("NG" -> 🇳🇬); "" for anything else. */
export function flagEmoji(code: string | null | undefined): string {
  const key = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(key)) return "";
  return String.fromCodePoint(...[...key].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** "Female" -> "F", "male" -> "M"; anything else -> "" (no assumption). */
export function genderInitial(gender: string | null | undefined): string {
  const g = (gender ?? "").trim().toLowerCase();
  if (g === "female") return "F";
  if (g === "male") return "M";
  return "";
}

/**
 * Relative time for presence: "just now", "5 minutes ago", "an hour ago",
 * "3 hours ago", "yesterday", "4 days ago", "2 weeks ago", "3 months ago", "a year ago".
 */
export function timeAgo(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const s = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "a minute ago" : `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "an hour ago" : `${h} hours ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  const w = Math.floor(d / 7);
  if (d < 30) return w === 1 ? "a week ago" : `${w} weeks ago`;
  const mo = Math.floor(d / 30);
  if (d < 365) return mo <= 1 ? "a month ago" : `${mo} months ago`;
  const y = Math.floor(d / 365);
  return y === 1 ? "a year ago" : `${y} years ago`;
}
