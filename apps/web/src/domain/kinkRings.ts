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
