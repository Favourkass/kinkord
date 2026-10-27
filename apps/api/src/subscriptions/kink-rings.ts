/**
 * Kink Rings (docs/KINK_RINGS.md): how many a Silver payment brings, and when
 * each expires. Pure: the payments and rings services store and spend them.
 */
import type { BillingPeriod } from "../db/schema";

/** A ring lasts this many days per month of Silver it came with. */
export const RING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Silver for a month brings one ring; for a year, twelve. */
export const RINGS_FOR: Record<BillingPeriod, number> = { monthly: 1, yearly: 12 };

/**
 * The rings a confirmed payment brings: the Nth expires 30 × N days after
 * `from`, so a year's twelve run out a month apart, 30 days to 360.
 */
export function ringsFor(
  period: BillingPeriod,
  from: Date,
): Array<{ seq: number; expiresAt: Date }> {
  return Array.from({ length: RINGS_FOR[period] }, (_, i) => ({
    seq: i + 1,
    expiresAt: new Date(from.getTime() + (i + 1) * RING_DAYS * DAY_MS),
  }));
}
