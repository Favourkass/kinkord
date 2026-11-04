import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  kinkRing,
  memberSubscription,
  profile,
  subscriptionPayment,
  user,
  type BillingPeriod,
} from "../db/schema";
import { silverGiven } from "./given-silver";
import { silverForGood } from "./plans";
import { silverFrom } from "./silver-time";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 50;

/**
 * How a member came to be on Silver now: paid for it themselves, a Kink Ring
 * someone gave them, both (rings stacked on paid time), or given by Kinkord
 * (the founders' gift, or Silver for good). "other" is Silver set some other
 * way, by hand.
 */
export type SilverSource = "subscription" | "ring" | "both" | "given" | "other";
export type SilverFilter = "all" | "subscription" | "ring" | "given";

export interface SilverMember {
  id: string;
  username: string | null;
  displayName: string | null;
  source: SilverSource;
  /** When their Silver runs out; Silver for good never does. */
  until: string;
  forGood: boolean;
  /** Their latest payment's plan, when they've paid. */
  plan: BillingPeriod | null;
}

export interface SilverMembers {
  /** Everyone on Silver now; someone on both counts under Subscription and Ring. */
  counts: Record<SilverFilter, number>;
  items: SilverMember[];
  nextPage: number | null;
}

/**
 * `paidEnd`: when their own payments alone would end it (see `silverFrom`).
 * Time past that came from rings, so long as they've been given one.
 */
export function silverSource(
  current: { end: Date; grantedBy: string | null },
  paidEnd: Date | null,
  ringsReceived: number,
  now: Date,
): SilverSource {
  if (silverGiven(current)) return "given";
  const paid = !!paidEnd && paidEnd > now;
  const ringTime =
    ringsReceived > 0 && (!paidEnd || current.end.getTime() > paidEnd.getTime() + DAY_MS);
  if (paid && ringTime) return "both";
  if (paid) return "subscription";
  return ringTime ? "ring" : "other";
}

const inFilter = (source: SilverSource, filter: SilverFilter) =>
  filter === "all" ||
  source === filter ||
  (source === "both" && (filter === "subscription" || filter === "ring"));

/** Everyone on Silver now, for admins (Moderation → Silver), and how each got it. */
@Injectable()
export class SilverMembersService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async list(
    filter: SilverFilter,
    q: string | undefined,
    page: number,
    now = new Date(),
  ): Promise<SilverMembers> {
    // Silver members are counted in hundreds, not millions: classify them all, then page.
    const rows = await this.db
      .select({
        id: user.id,
        username: user.username,
        displayName: profile.displayName,
        end: memberSubscription.currentPeriodEnd,
        grantedBy: memberSubscription.grantedBy,
      })
      .from(memberSubscription)
      .innerJoin(user, eq(user.id, memberSubscription.userId))
      .leftJoin(profile, eq(profile.userId, memberSubscription.userId))
      .where(gt(memberSubscription.currentPeriodEnd, now))
      .orderBy(desc(memberSubscription.startedAt), desc(memberSubscription.userId));
    const ids = rows.map((r) => r.id);
    const [payments, rings] = ids.length
      ? await Promise.all([
          this.db
            .select({
              userId: subscriptionPayment.userId,
              at: subscriptionPayment.reviewedAt,
              period: subscriptionPayment.period,
            })
            .from(subscriptionPayment)
            .where(
              and(
                inArray(subscriptionPayment.userId, ids),
                eq(subscriptionPayment.status, "verified"),
                eq(subscriptionPayment.purpose, "silver"),
                isNotNull(subscriptionPayment.reviewedAt),
              ),
            ),
          this.db
            .select({ userId: kinkRing.givenTo, n: count() })
            .from(kinkRing)
            .where(
              and(
                inArray(kinkRing.givenTo, ids),
                isNotNull(kinkRing.givenAt),
                isNull(kinkRing.usageCancelledAt),
              ),
            )
            .groupBy(kinkRing.givenTo),
        ])
      : [[], []];

    const members = rows.map((row): SilverMember => {
      const own = payments
        .filter((p) => p.userId === row.id)
        .map((p) => ({ at: p.at!, period: p.period }))
        .sort((a, b) => a.at.getTime() - b.at.getTime());
      const received = Number(rings.find((r) => r.userId === row.id)?.n ?? 0);
      return {
        id: row.id,
        username: row.username,
        displayName: row.displayName,
        source: silverSource(row, silverFrom(own), received, now),
        until: row.end.toISOString(),
        forGood: silverForGood(row.end),
        plan: own.at(-1)?.period ?? null,
      };
    });
    const counts = {
      all: members.length,
      subscription: members.filter((m) => inFilter(m.source, "subscription")).length,
      ring: members.filter((m) => inFilter(m.source, "ring")).length,
      given: members.filter((m) => m.source === "given").length,
    };
    const needle = q?.trim().replace(/^@/, "").toLowerCase();
    const shown = members.filter(
      (m) =>
        inFilter(m.source, filter) &&
        (!needle ||
          m.username?.toLowerCase().includes(needle) ||
          m.displayName?.toLowerCase().includes(needle)),
    );
    const start = (page - 1) * PAGE_SIZE;
    return {
      counts,
      items: shown.slice(start, start + PAGE_SIZE),
      nextPage: shown.length > start + PAGE_SIZE ? page + 1 : null,
    };
  }
}
