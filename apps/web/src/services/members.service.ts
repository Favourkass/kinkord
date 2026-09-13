/**
 * Members directory + follow graph: API access and the pure rules the directory
 * screens share (country search, state/region lists, optimistic follow toggles).
 */
import { ALL_COUNTRY_CODES } from "@/constants/countries";
import { AVAILABLE_COUNTRIES } from "@/constants/members";
import { NG_LGAS } from "@/constants/nigeria";
import type { MemberCardPM, PublicProfilePM } from "@/domain/member";
import { countryName } from "@/util/format";
import { api } from "./apiClient";

export interface CountryCountPM {
  code: string;
  name: string;
  membersCount: number;
}

export interface StateCountPM {
  state: string;
  membersCount: number;
}

export interface FriendPM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  isFollowing: boolean;
}

export interface FriendsPagePM {
  items: FriendPM[];
  total: number;
  page: number;
  limit: number;
}

export type FriendsTab = "all" | "mutual";

export interface MembersPagePM {
  items: MemberCardPM[];
  total: number;
  page: number;
  limit: number;
}

export type MembersSort = "recent" | "followers" | "name";
const SORT_CYCLE: MembersSort[] = ["recent", "followers", "name"];

/** Next mode when the user taps "Sort": newest → most followed → name → newest. */
export function nextSort(mode: MembersSort): MembersSort {
  return SORT_CYCLE[(SORT_CYCLE.indexOf(mode) + 1) % SORT_CYCLE.length];
}

export interface MembersPageParams {
  country: string;
  /** Omit to list the whole country (CEO, 2026-09-12); a state narrows to that state. */
  state?: string | null;
  /** LGA / area filter within `state`; omit to list the whole state (CEO, 2026-09-08). */
  region?: string | null;
  page: number;
  limit: number;
  sort?: MembersSort;
}

export const membersApi = {
  countries: () => api.get<CountryCountPM[]>("/members/countries"),
  states: (country: string) =>
    api.get<StateCountPM[]>(`/members/states?country=${encodeURIComponent(country.toUpperCase())}`),
  page: (p: MembersPageParams) => {
    const qs = new URLSearchParams({ country: p.country.toUpperCase() });
    if (p.state) qs.set("state", p.state);
    if (p.state && p.region) qs.set("lga", p.region);
    qs.set("page", String(p.page));
    qs.set("limit", String(p.limit));
    if (p.sort) qs.set("sort", p.sort);
    return api.get<MembersPagePM>(`/members?${qs.toString()}`);
  },
  profile: (username: string) =>
    api.get<PublicProfilePM>(`/profiles/${encodeURIComponent(username.replace(/^@/, ""))}`),
  friends: (username: string, tab: FriendsTab, page: number, limit: number) =>
    api.get<FriendsPagePM>(
      `/profiles/${encodeURIComponent(username.replace(/^@/, ""))}/friends?tab=${tab}&page=${page}&limit=${limit}`,
    ),
  follow: (username: string) =>
    api.post<unknown>(`/follows/${encodeURIComponent(username.replace(/^@/, ""))}`, {}),
  unfollow: (username: string) =>
    api.del<unknown>(`/follows/${encodeURIComponent(username.replace(/^@/, ""))}`),
};

export interface CountryOption {
  code: string;
  name: string;
  /** Local asset for launched countries; null for "coming soon" ones (emoji flag instead). */
  flag: string | null;
  /** null while counts are still loading. */
  membersCount: number | null;
  available: boolean;
}

export function isCountryAvailable(code: string): boolean {
  const key = code.toUpperCase();
  return AVAILABLE_COUNTRIES.some((c) => c.code === key);
}

/**
 * Country search per the CEO brief: with no query only launched countries show;
 * with a query, launched matches come first (with counts) and every other real
 * country that matches appears as "coming soon".
 */
export function searchCountries(query: string, counts: CountryCountPM[] | null): CountryOption[] {
  const q = query.trim().toLowerCase();
  const countFor = (code: string) =>
    counts === null ? null : (counts.find((c) => c.code === code)?.membersCount ?? 0);
  const launched: CountryOption[] = AVAILABLE_COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
    flag: c.flag,
    membersCount: countFor(c.code),
    available: true,
  }));
  if (!q) return launched;
  const matches = (name: string) => name.toLowerCase().includes(q);
  const launchedHits = launched.filter((c) => matches(c.name));
  const comingSoon = ALL_COUNTRY_CODES.filter((code) => !isCountryAvailable(code))
    .map((code) => ({ code, name: countryName(code) ?? code }))
    .filter((c) => matches(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map<CountryOption>((c) => ({ ...c, flag: null, membersCount: null, available: false }));
  return [...launchedHits, ...comingSoon];
}

/** Configured states for a launched country, in the product team's order. */
export function statesForCountry(code: string): string[] {
  return code.toUpperCase() === "NG" ? Object.keys(NG_LGAS) : [];
}

/** Configured regions (LGAs / areas) for a state; empty when the state is unknown. */
export function regionsForState(code: string, state: string): string[] {
  if (code.toUpperCase() !== "NG") return [];
  return [...(NG_LGAS[state] ?? [])];
}

/** Optimistic follow flip for a directory card. */
export function toggleFollowOnCard(pm: MemberCardPM): MemberCardPM {
  return {
    ...pm,
    isFollowing: !pm.isFollowing,
    followersCount: pm.isFollowing ? Math.max(0, pm.followersCount - 1) : pm.followersCount + 1,
  };
}

/** Optimistic follow flip for a public profile header. */
export function toggleFollowOnProfile(pm: PublicProfilePM): PublicProfilePM {
  return {
    ...pm,
    isFollowing: !pm.isFollowing,
    counts: {
      ...pm.counts,
      followers: pm.isFollowing ? Math.max(0, pm.counts.followers - 1) : pm.counts.followers + 1,
    },
  };
}

/** Optimistic follow flip for a friends-list row (no follower count on the row). */
export function toggleFollowOnFriend(pm: FriendPM): FriendPM {
  return { ...pm, isFollowing: !pm.isFollowing };
}

export function hasMore(loaded: number, total: number): boolean {
  return loaded < total;
}

/** Route params arrive URL-encoded in some runtimes and decoded in others; accept both. */
export function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
