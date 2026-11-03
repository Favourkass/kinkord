import { inArray } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { appSetting, type BillingPeriod } from "../db/schema";
import { MAX_RINGS, RINGS_FOR } from "./kink-rings";

/** The client or an open transaction: both run the same queries. */
type Queryable = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** How many Kink Rings each Silver plan brings. */
export type RingsPerPlan = Record<BillingPeriod, number>;

const KEYS: Record<BillingPeriod, string> = {
  monthly: "kink_rings_monthly",
  yearly: "kink_rings_yearly",
};
const PERIODS = ["monthly", "yearly"] as const;

/** The founders' numbers (Moderation → Kink Rings), else one for a month and twelve for a year. */
export async function ringsPerPlan(db: Queryable): Promise<RingsPerPlan> {
  const rows = await db
    .select({ key: appSetting.key, value: appSetting.value })
    .from(appSetting)
    .where(inArray(appSetting.key, Object.values(KEYS)));
  const read = (period: BillingPeriod) => {
    const n = Number(rows.find((r) => r.key === KEYS[period])?.value ?? NaN);
    return Number.isInteger(n) && n >= 0 && n <= MAX_RINGS ? n : RINGS_FOR[period];
  };
  return { monthly: read("monthly"), yearly: read("yearly") };
}

/** Checkouts from now on bring these; payments already made keep what they were offered. */
export async function saveRingsPerPlan(
  db: Queryable,
  rings: RingsPerPlan,
  byUserId: string,
  now = new Date(),
): Promise<void> {
  for (const period of PERIODS) {
    const value = String(rings[period]);
    await db
      .insert(appSetting)
      .values({ key: KEYS[period], value, updatedBy: byUserId, updatedAt: now })
      .onConflictDoUpdate({
        target: appSetting.key,
        set: { value, updatedBy: byUserId, updatedAt: now },
      });
  }
}
