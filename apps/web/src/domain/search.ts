/**
 * The app's search: its tabs and the people it finds. Posts it finds are the
 * feed's own, so a result behaves like the post it is.
 */
import { ageTagOf, locationOf, type MemberCardPM } from "./member";

export type SearchTab = "all" | "people" | "posts";

export const SEARCH_TABS: SearchTab[] = ["all", "people", "posts"];

export function isSearchTab(value: string): value is SearchTab {
  return (SEARCH_TABS as string[]).includes(value);
}

/**
 * What people are looked up by. The API reads "@ada" as "ada", so a search of
 * only "@" is no one's name: nobody to ask for (the API would refuse it).
 */
export function peopleQuery(term: string): string {
  return term.replace(/^@+/, "").trim();
}

/** People the All tab shows before "See all people". */
export const SEARCH_PEOPLE_PREVIEW = 5;

export interface SearchPersonVM {
  userId: string;
  name: string;
  /** "@ada", or null for a member without a username. */
  handle: string | null;
  /** "25F · Ikeja, Lagos State", or null when neither is known. */
  details: string | null;
  avatarUrl: string | null;
  silver: boolean;
  isFollowing: boolean;
  /** Profiles open by username, so a member without one has no link (and no Follow). */
  href: string | null;
  canFollow: boolean;
}

export function toSearchPersonVM(
  pm: MemberCardPM,
  memberHref: (username: string) => string,
): SearchPersonVM {
  return {
    userId: pm.userId,
    name: pm.displayName || pm.username || "",
    handle: pm.username ? `@${pm.username}` : null,
    details:
      [ageTagOf(pm.age, pm.gender), locationOf(pm.city, pm.state)].filter(Boolean).join(" · ") ||
      null,
    avatarUrl: pm.avatarUrl,
    silver: Boolean(pm.silver),
    isFollowing: pm.isFollowing,
    href: pm.username ? memberHref(pm.username) : null,
    canFollow: Boolean(pm.username),
  };
}
