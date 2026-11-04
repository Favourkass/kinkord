/**
 * Kink Rings (docs/KINK_RINGS.md): how many a Silver payment brings, and when
 * each expires. Pure: the payments and rings services store and spend them.
 */
import type { BillingPeriod } from "../db/schema";

/** A ring lasts this many days per month of Silver it came with. */
export const RING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Until the founders set their own (Moderation → Kink Rings): Silver for a
 * month brings one ring; for a year, twelve. Payments made before the
 * founders could set it bring these too.
 */
export const RINGS_FOR: Record<BillingPeriod, number> = { monthly: 1, yearly: 12 };

/** The most rings a plan can bring: the last would expire two years on. */
export const MAX_RINGS = 24;

/**
 * The `count` rings a confirmed payment brings: the Nth expires 30 × N days
 * after `from`, so they run out a month apart (twelve: 30 days to 360).
 */
export function ringsFor(count: number, from: Date): Array<{ seq: number; expiresAt: Date }> {
  return Array.from({ length: count }, (_, i) => ({
    seq: i + 1,
    expiresAt: new Date(from.getTime() + (i + 1) * RING_DAYS * DAY_MS),
  }));
}
