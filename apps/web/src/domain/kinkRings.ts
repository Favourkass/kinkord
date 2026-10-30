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
export interface RingInventoryPM {
  available: RingInventoryItemPM[];
  expired: RingPagePM<RingInventoryItemPM> & { total: number };
  history: RingPagePM<RingHistoryPM>;
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
