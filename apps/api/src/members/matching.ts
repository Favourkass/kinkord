/**
 * Matching v1: who "Kinksters Near You" suggests to a member, and in what order.
 *
 * Pure rules with no database: MembersService gathers the pool, this module
 * decides who is shown and ranks them. The home feed's For You ranks by the
 * kink parts of the same rules (`kinkParts`, posts/feed-ranking.ts). The
 * weights are explained in docs/MATCHING.md; change both together.
 *
 * Only the viewer's own sexuality is ever read here. Other members' sexuality
 * is private and plays no part in who they are shown to.
 */
import { PresenceService } from "../presence/presence.service";
import { GENDERS, type Gender, type ORIENTATIONS } from "../profiles/profile-options";

/** Which members the strip lists: women, men, or both mixed together. */
export const SHOW_OPTIONS = ["women", "men", "all"] as const;
export type Show = (typeof SHOW_OPTIONS)[number];

type Orientation = (typeof ORIENTATIONS)[number];

/** Sign-up stored "male"/"female", Edit Profile stores "Male"/"Female": read either as one. */
export function canonicalGender(value: string | null | undefined): Gender | null {
  const v = (value ?? "").trim().toLowerCase();
  return GENDERS.find((g) => g.toLowerCase() === v) ?? null;
}

/** The gender a "women" or "men" strip lists; null for "all". */
export function genderShown(show: Show): Gender | null {
  if (show === "all") return null;
  return show === "women" ? "Female" : "Male";
}

/** Into the other gender. With no gender of their own to go by: everyone. */
const otherGender = (own: Gender | null): Show =>
  own === "Female" ? "men" : own === "Male" ? "women" : "all";
/** Into their own gender: for "Gay"/"Lesbian", should ORIENTATIONS offer them. */
export const sameGender = (own: Gender | null): Show =>
  own === "Female" ? "women" : own === "Male" ? "men" : "all";
const everyone = (): Show => "all";

/**
 * Who each sexuality is shown, given the member's own gender. A sexuality
 * added to ORIENTATIONS fails to compile until it gets its line here, e.g.
 * `Gay: sameGender,`.
 */
const SHOWN_BY_SEXUALITY: Record<Orientation, (own: Gender | null) => Show> = {
  Straight: otherGender,
  Bisexual: everyone,
};

/**
 * Who a member is shown when they haven't picked: their sexuality decides when
 * they've given it, otherwise their gender does (men see women, women see men),
 * and with neither, everyone.
 */
export function defaultShow(
  gender: string | null | undefined,
  orientation: string | null | undefined,
): Show {
  const own = canonicalGender(gender);
  if (orientation && Object.hasOwn(SHOWN_BY_SEXUALITY, orientation)) {
    return SHOWN_BY_SEXUALITY[orientation as Orientation](own);
  }
  return otherGender(own);
}

/** The segments offered: "All" leads for members who see everyone by default. */
export function showOptions(fallback: Show): Show[] {
  return fallback === "all" ? ["all", "women", "men"] : ["women", "men"];
}

/** The segment to rank for: the one asked for when it is offered, else the default. */
export function resolveShow(
  requested: Show | null | undefined,
  gender: string | null | undefined,
  orientation: string | null | undefined,
): { show: Show; options: Show[] } {
  const fallback = defaultShow(gender, orientation);
  const options = showOptions(fallback);
  return { show: requested && options.includes(requested) ? requested : fallback, options };
}

// ---- kink roles ------------------------------------------------------------

export const DOM_SIDE = [
  "Dominant",
  "Domme",
  "Master",
  "Mistress",
  "Owner",
  "Sadist",
  "Top",
  "Brat Tamer",
  "Handler",
  "Rigger",
  "Caregiver",
  "Affini",
] as const;

export const SUB_SIDE = [
  "Submissive",
  "Slave",
  "Bottom",
  "Pet",
  "Masochist",
  "Brat",
  "Little",
  "Rope Bunny",
  "Adult Baby",
  "Adult Baby Diaper Lover (ABDL)",
  "Acolyte",
  "Affection Slut",
  "Cuckold",
] as const;

const DOM = new Set<string>(DOM_SIDE);
const SUB = new Set<string>(SUB_SIDE);
const SWITCH = "Switch";

export type Side = "dom" | "sub";
/** The side a member looks for: the other one, "either" (a Switch, or both sides), or no preference. */
export type Wanted = Side | "either" | null;

export interface Sides {
  dom: boolean;
  sub: boolean;
  switch: boolean;
}

/** Which sides a member's roles put them on. Roles on neither side (Voyeur, Curious…) count for none. */
export function sidesOf(roles: readonly string[]): Sides {
  return {
    dom: roles.some((r) => DOM.has(r)),
    sub: roles.some((r) => SUB.has(r)),
    switch: roles.includes(SWITCH),
  };
}

/** Dom-only members want subs, sub-only members want doms, Switches (or both sides) want either. */
export function wantedSide(roles: readonly string[]): Wanted {
  const s = sidesOf(roles);
  if (s.switch || (s.dom && s.sub)) return "either";
  if (s.dom) return "sub";
  if (s.sub) return "dom";
  return null;
}

const onWantedSide = (role: string, wanted: Exclude<Wanted, null>) =>
  wanted === "either" ? DOM.has(role) || SUB.has(role) : (wanted === "dom" ? DOM : SUB).has(role);

/** Every weight in one place; docs/MATCHING.md explains them. */
export const WEIGHTS = {
  wantedSide: 4,
  switchCandidate: 2,
  ownSideOnly: -2,
  pair: 2,
  pairCap: 4,
  sharedKink: 1,
  sharedKinkCap: 5,
  sharedLookingFor: 1,
  sharedLookingForCap: 3,
  sameCity: 4,
  sameState: 3,
  online: 2,
  seenThisWeek: 1,
  photo: 2,
} as const;

/** How well a candidate's side suits what the viewer looks for. */
export function roleSideScore(wanted: Wanted, candidateRoles: readonly string[]): number {
  if (!wanted) return 0;
  const c = sidesOf(candidateRoles);
  if (wanted === "either" ? c.dom || c.sub : c[wanted]) return WEIGHTS.wantedSide;
  if (c.switch) return WEIGHTS.switchCandidate;
  // Only on the viewer's own side: a dom shown another dom.
  if (wanted !== "either" && c[wanted === "dom" ? "sub" : "dom"]) return WEIGHTS.ownSideOnly;
  return 0;
}

/** Roles that complete each other, either way round. */
const PAIRS: readonly (readonly [readonly string[], readonly string[]])[] = [
  [["Dominant", "Domme"], ["Submissive"]],
  [["Master", "Mistress"], ["Slave"]],
  [["Top"], ["Bottom"]],
  [["Sadist"], ["Masochist"]],
  [["Owner", "Handler"], ["Pet"]],
  [["Brat Tamer"], ["Brat"]],
  [["Rigger"], ["Rope Bunny"]],
  [["Caregiver"], ["Little", "Adult Baby", "Adult Baby Diaper Lover (ABDL)"]],
  [["Exhibitionist"], ["Voyeur"]],
];

/** +2 for each pair the two complete, up to +4. */
export function pairBonus(viewerRoles: readonly string[], candidateRoles: readonly string[]) {
  const v = new Set(viewerRoles);
  const c = new Set(candidateRoles);
  const has = (roles: Set<string>, names: readonly string[]) => names.some((n) => roles.has(n));
  const pairs = PAIRS.filter(
    ([a, b]) => (has(v, a) && has(c, b)) || (has(v, b) && has(c, a)),
  ).length;
  return Math.min(pairs * WEIGHTS.pair, WEIGHTS.pairCap);
}

/** How many different values the two lists share. */
export function shared(a: readonly string[], b: readonly string[]): number {
  const mine = new Set(a);
  return new Set(b.filter((x) => mine.has(x))).size;
}

/** Both known and the same, case and stray spaces aside: "Lagos" is "lagos ". */
export const samePlace = (a: string | null, b: string | null) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---- scoring ---------------------------------------------------------------

/** What the kink parts of the score read: roles, kinks and looking-for. */
export interface KinkProfile {
  roles: readonly string[];
  /** The profile's "Kinks & interests" (`profile.interests`). */
  kinks: readonly string[];
  lookingFor: readonly string[];
}

/** What matching reads from the viewer: their own profile. */
export interface MatchViewer extends KinkProfile {
  city: string | null;
  state: string | null;
}

/** What matching reads from each candidate. Never their sexuality. */
export interface MatchCandidate extends MatchViewer {
  userId: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  hasPhoto: boolean;
}

export interface ScoreParts {
  side: number;
  pairs: number;
  kinks: number;
  lookingFor: number;
  place: number;
  presence: number;
  photo: number;
}

export type KinkParts = Pick<ScoreParts, "side" | "pairs" | "kinks" | "lookingFor">;

/**
 * The kink parts of the score: role side, pairs, shared kinks and shared
 * looking-for. Place, presence and photo are about meeting someone; the home
 * feed's For You reuses only these.
 */
export function kinkParts(viewer: KinkProfile, candidate: KinkProfile): KinkParts {
  return {
    side: roleSideScore(wantedSide(viewer.roles), candidate.roles),
    pairs: pairBonus(viewer.roles, candidate.roles),
    kinks: Math.min(
      shared(viewer.kinks, candidate.kinks) * WEIGHTS.sharedKink,
      WEIGHTS.sharedKinkCap,
    ),
    lookingFor: Math.min(
      shared(viewer.lookingFor, candidate.lookingFor) * WEIGHTS.sharedLookingFor,
      WEIGHTS.sharedLookingForCap,
    ),
  };
}

/** The score, part by part: easier to test, and to explain a ranking. */
export function scoreParts(
  viewer: MatchViewer,
  candidate: MatchCandidate,
  now = new Date(),
): ScoreParts {
  const sameState = samePlace(viewer.state, candidate.state);
  const seenAgo = candidate.lastSeenAt ? now.getTime() - candidate.lastSeenAt.getTime() : null;
  return {
    ...kinkParts(viewer, candidate),
    // The nearer tier only: the same city (within the same state), else the same state.
    place:
      sameState && samePlace(viewer.city, candidate.city)
        ? WEIGHTS.sameCity
        : sameState
          ? WEIGHTS.sameState
          : 0,
    // Likewise: online now, else seen this week.
    presence: PresenceService.isOnline(candidate.lastSeenAt, now)
      ? WEIGHTS.online
      : seenAgo !== null && seenAgo < WEEK_MS
        ? WEIGHTS.seenThisWeek
        : 0,
    photo: candidate.hasPhoto ? WEIGHTS.photo : 0,
  };
}

export function matchScore(viewer: MatchViewer, candidate: MatchCandidate, now = new Date()) {
  const p = scoreParts(viewer, candidate, now);
  return p.side + p.pairs + p.kinks + p.lookingFor + p.place + p.presence + p.photo;
}

/**
 * Best match first. Ties go to whoever was seen most recently, then to the
 * newest account; the id settles anything left, so the order never wobbles.
 */
export function rankCandidates<T extends MatchCandidate>(
  viewer: MatchViewer,
  candidates: readonly T[],
  now = new Date(),
): T[] {
  return candidates
    .map((candidate) => ({ candidate, score: matchScore(viewer, candidate, now) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.candidate.lastSeenAt?.getTime() ?? 0) - (a.candidate.lastSeenAt?.getTime() ?? 0) ||
        b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime() ||
        a.candidate.userId.localeCompare(b.candidate.userId),
    )
    .map(({ candidate }) => candidate);
}

/** The roles a card shows: those on the side the viewer looks for first, three at most. */
export function cardRoles(roles: readonly string[], wanted: Wanted, max = 3): string[] {
  if (!wanted) return roles.slice(0, max);
  const first = roles.filter((r) => onWantedSide(r, wanted));
  const rest = roles.filter((r) => !onWantedSide(r, wanted));
  return [...first, ...rest].slice(0, max);
}
