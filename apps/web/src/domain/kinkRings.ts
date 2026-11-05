/** Kink Rings (docs/KINK_RINGS.md): a month of Silver to give away. */
import { planDate } from "./subscription";

/** GET /kink-rings */
export interface KinkRingsPM {
  /** The rings the member can give, soonest to expire first. */
  available: Array<{ id: string; expiresAt: string }>;
  /** The last ones they gave, newest first; `to` is null once that member has left. */
  given: Array<{
    id: string;
    givenAt: string;
    to: { username: string | null; displayName: string } | null;
  }>;
}

/** POST /kink-rings/give */
export interface GiveRingPM {
  ringId: string;
  to: { username: string | null; displayName: string };
  left: number;
}

export interface KinkRingsLabels {
  /** "You have 3 Kink Rings to give" */
  count: (n: number) => string;
  /** "Expires 26 Nov 2026" */
  expires: (date: string) => string;
  /** "Ada, 27 Oct 2026" */
  givenTo: (name: string, date: string) => string;
  /** For a member who has since left. */
  someoneGone: string;
}

export interface KinkRingsVM {
  count: number;
  heading: string;
  rings: Array<{ id: string; expires: string }>;
  given: Array<{ id: string; line: string; href: string | null }>;
}

/** The screen's lines for the member's rings, dates in Lagos time as the Silver screens show them. */
export function toKinkRingsVM(
  pm: KinkRingsPM,
  labels: KinkRingsLabels,
  hrefFor: (username: string | null) => string | null,
): KinkRingsVM {
  return {
    count: pm.available.length,
    heading: labels.count(pm.available.length),
    rings: pm.available.map((r) => ({ id: r.id, expires: labels.expires(planDate(r.expiresAt)) })),
    given: pm.given.map((g) => ({
      id: g.id,
      line: labels.givenTo(g.to?.displayName ?? labels.someoneGone, planDate(g.givenAt)),
      href: g.to ? hrefFor(g.to.username) : null,
    })),
  };
}

export interface RingInventoryItemPM {
  id: string;
  createdAt: string;
  expiresAt: string;
  source: "purchase" | "award";
}
export interface RingHistoryPM {
  id: string;
  givenAt: string;
  to: { username: string | null; name: string; avatarUrl: string | null } | null;
  status: "active" | "expired" | "gifted";
}
export interface RingRecipientPM {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  online: boolean;
  /** Their messaging setting lets the giver write to them, so a note can go with the ring. Missing on an older API. */
  canMessage?: boolean;
}
export interface RingPagePM<T> {
  items: T[];
  nextPage: number | null;
}
/** How many Kink Rings each Silver plan brings, as the founders set them. */
export interface RingsPerPlanPM {
  monthly: number;
  yearly: number;
}

export interface RingSettingsPM {
  rings: RingsPerPlanPM;
  /** What 2 bought rings cost, in US cents; absent from an API that predates the setting. */
  pairUsdCents?: number;
  canEdit: boolean;
  /** The most rings a plan can bring. */
  max: number;
}

/** The founders' form as counts, or null unless each is a whole number from 0 to `max`. */
export function ringCountsFrom(
  form: { monthly: string; yearly: string },
  max: number,
): RingsPerPlanPM | null {
  const read = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN);
  const monthly = read(form.monthly);
  const yearly = read(form.yearly);
  return [monthly, yearly].every((n) => Number.isInteger(n) && n >= 0 && n <= max)
    ? { monthly, yearly }
    : null;
}

/** The founders' "4.99" or "$5" as cents; null unless it's a dollar amount with at most 2 decimals. */
export function pairPriceFrom(input: string): number | null {
  const text = input.trim().replace(/^\$/, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [dollars, cents = ""] = text.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

export interface RingInventoryPM {
  available: RingInventoryItemPM[];
  expired: RingPagePM<RingInventoryItemPM> & { total: number };
  history: RingPagePM<RingHistoryPM>;
  /** Missing from an API that predates the founders' setting. */
  perPlan?: RingsPerPlanPM;
}
export interface RingItemVM {
  id: string;
  code: string;
  received: string;
  expires: string;
  remaining: string;
  urgent: boolean;
  expired: boolean;
}
export function toRingItemVM(ring: RingInventoryItemPM, now: Date): RingItemVM {
  const remaining = new Date(ring.expiresAt).getTime() - now.getTime();
  const days = Math.ceil(remaining / 86_400_000);
  return {
    id: ring.id,
    code: `KR-${ring.id.slice(0, 8).toUpperCase()}`,
    received: `${ring.source === "purchase" ? "Purchased" : "Received"}: ${planDate(ring.createdAt)}`,
    expires: `Expires: ${planDate(ring.expiresAt)}`,
    remaining: remaining <= 0 ? "Expired" : days === 1 ? "1 day left" : `${days} days left`,
    urgent: remaining > 0 && days <= 7,
    expired: remaining <= 0,
  };
}
export interface RingHistoryVM {
  id: string;
  name: string;
  handle: string | null;
  date: string;
  avatarUrl: string | null;
  status: string;
  active: boolean;
  href: string | null;
}
export function toRingHistoryVM(row: RingHistoryPM, hrefFor: (u: string) => string): RingHistoryVM {
  return {
    id: row.id,
    name: row.to?.name ?? "Member unavailable",
    handle: row.to?.username ? `@${row.to.username}` : null,
    date: planDate(row.givenAt),
    avatarUrl: row.to?.avatarUrl ?? null,
    status: row.status === "active" ? "Active" : row.status === "expired" ? "Expired" : "Gifted",
    active: row.status === "active",
    href: row.to?.username ? hrefFor(row.to.username) : null,
  };
}

/** Persisted draft selections, before display formatting. */
export interface RingRecipientDraft {
  member: RingRecipientPM;
  ringIds: string[];
  message: string;
}
export interface RingGiftAssignment {
  ringId: string;
  username: string;
  message?: string;
}

/** Moderation → Members → member: their rings as admins see them (GET /admin/members/:id/kink-rings). */
/** "cancelled": an admin took it back before it was given. */
export type AdminRingStatus = "unused" | "given" | "expired" | "cancelled";

export interface AdminRingPersonPM {
  id: string;
  username: string | null;
  displayName: string | null;
}

export interface MemberRingsPM {
  counts: {
    total: number;
    /** Their balance: rings they can still give. */
    unused: number;
    given: number;
    expired: number;
    cancelled: number;
    received: number;
  };
  batches: Array<{
    paymentId: string | null;
    period: "monthly" | "yearly" | null;
    /** Rings bought on their own, and how they were paid for; absent from an older API. */
    bought?: { quantity: number; method: "bank" | "coins" } | null;
    confirmedAt: string | null;
    rings: Array<{
      id: string;
      seq: number;
      status: AdminRingStatus;
      expiresAt: string;
      givenAt: string | null;
      recipient: AdminRingPersonPM | null;
      recipientLeft: boolean;
      withNote: boolean;
      /** An admin took back the month of Silver it gave. */
      silverCancelled: boolean;
    }>;
  }>;
  received: Array<{
    id: string;
    givenAt: string | null;
    giver: AdminRingPersonPM;
    withNote: boolean;
    silverCancelled: boolean;
  }>;
}

export interface MemberRingsLabels {
  summary: (counts: MemberRingsPM["counts"]) => string;
  batch: (period: "monthly" | "yearly", confirmed: string | null) => string;
  bought: (quantity: number, method: "bank" | "coins", confirmed: string | null) => string;
  fromKinkord: string;
  ring: (seq: number) => string;
  status: Record<AdminRingStatus, string>;
  givenTo: (who: string, date: string) => string;
  expires: (date: string) => string;
  expired: (date: string) => string;
  cancelled: string;
  withNote: string;
  silverCancelled: string;
  someoneGone: string;
  thisMember: string;
  receivedFrom: (who: string, date: string) => string;
}

export interface MemberRingsVM {
  summary: string;
  empty: boolean;
  /** They have rings left to give, which an admin can take back. */
  canCancelUnused: boolean;
  unused: number;
  batches: Array<{
    key: string;
    heading: string;
    rings: Array<{
      id: string;
      label: string;
      status: AdminRingStatus;
      statusLabel: string;
      line: string;
      href: string | null;
      /** Whose month of Silver cancelling would take back; null when there's none to take. */
      cancelSilverOf: string | null;
    }>;
  }>;
  received: Array<{ id: string; line: string; href: string | null; cancelSilverOf: string | null }>;
}

/** "@tega (Tega)", or whichever of the two exists. */
function personLabel(person: AdminRingPersonPM): string {
  const handle = person.username ? `@${person.username}` : null;
  if (handle && person.displayName) return `${handle} (${person.displayName})`;
  return handle ?? person.displayName ?? person.id;
}

/** Each payment's rings with where each stands, who got it and when it runs out, in Lagos time. */
export function toMemberRingsVM(
  pm: MemberRingsPM,
  labels: MemberRingsLabels,
  hrefFor: (memberId: string) => string,
): MemberRingsVM {
  const silver = (cancelled: boolean) => (cancelled ? ` · ${labels.silverCancelled}` : "");
  return {
    summary: labels.summary(pm.counts),
    empty: pm.counts.total === 0 && pm.counts.received === 0,
    canCancelUnused: pm.counts.unused > 0,
    unused: pm.counts.unused,
    batches: pm.batches.map((batch) => ({
      key: batch.paymentId ?? "kinkord",
      heading: batch.bought
        ? labels.bought(
            batch.bought.quantity,
            batch.bought.method,
            batch.confirmedAt ? planDate(batch.confirmedAt) : null,
          )
        : batch.period
          ? labels.batch(batch.period, batch.confirmedAt ? planDate(batch.confirmedAt) : null)
          : labels.fromKinkord,
      rings: batch.rings.map((ring) => {
        const who = ring.recipient ? personLabel(ring.recipient) : labels.someoneGone;
        const note = ring.withNote ? ` · ${labels.withNote}` : "";
        const line =
          ring.status === "given"
            ? labels.givenTo(who, ring.givenAt ? planDate(ring.givenAt) : "—") +
              note +
              silver(ring.silverCancelled)
            : ring.status === "cancelled"
              ? labels.cancelled
              : ring.status === "expired"
                ? labels.expired(planDate(ring.expiresAt))
                : labels.expires(planDate(ring.expiresAt));
        return {
          id: ring.id,
          label: labels.ring(ring.seq),
          status: ring.status,
          statusLabel: labels.status[ring.status],
          line,
          href: ring.recipient ? hrefFor(ring.recipient.id) : null,
          cancelSilverOf:
            ring.status === "given" && ring.recipient && !ring.silverCancelled ? who : null,
        };
      }),
    })),
    received: pm.received.map((ring) => ({
      id: ring.id,
      line:
        labels.receivedFrom(personLabel(ring.giver), ring.givenAt ? planDate(ring.givenAt) : "—") +
        (ring.withNote ? ` · ${labels.withNote}` : "") +
        silver(ring.silverCancelled),
      href: hrefFor(ring.giver.id),
      cancelSilverOf: ring.silverCancelled ? null : labels.thisMember,
    })),
  };
}
