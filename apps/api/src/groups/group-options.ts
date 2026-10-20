/**
 * What a group can be and the limits around groups. The categories exist so
 * groups can be found by what they're about; FetLife has none, and its groups
 * fill their descriptions with keywords instead.
 */
export const GROUP_CATEGORIES = [
  "local",
  "interests",
  "lifestyle",
  "identity",
  "education",
  "social",
  "official",
] as const;
export type GroupCategory = (typeof GROUP_CATEGORIES)[number];

/** Kinkord's own groups. Only the founders and admins may file a group here. */
export const OFFICIAL_CATEGORY: GroupCategory = "official";

export const GROUP_NAME_MIN = 3;
export const GROUP_NAME_MAX = 60;
export const GROUP_DESCRIPTION_MIN = 10;
export const GROUP_DESCRIPTION_MAX = 2000;
export const GROUP_RULES_MAX = 4000;
export const THREAD_TITLE_MIN = 3;
export const THREAD_TITLE_MAX = 120;

/** One member can own this many groups (FetLife caps it too, after people hoarded names). */
export const GROUPS_OWNED_MAX = 5;
/** A new account waits this long before it can create a group. */
export const GROUP_CREATE_MIN_ACCOUNT_DAYS = 7;
/** New discussions one member can start in a day, across every group. */
export const THREADS_PER_DAY = 10;

export const GROUPS_PAGE_SIZE = 20;
export const THREADS_PAGE_SIZE = 20;
export const MEMBERS_PAGE_SIZE = 30;

const SLUG_MAX = 48;

/**
 * The address a name gets: lowercase letters, digits and dashes. Accents fold
 * to plain letters; a name with nothing usable becomes "group".
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  // An address the API reads as a route of its own gets a suffix.
  if (RESERVED_SLUGS.has(slug)) return `${slug}-group`;
  return slug || "group";
}

/** Group addresses that would collide with /groups/<route> in the API. */
const RESERVED_SLUGS = new Set(["options", "new"]);

/** The addresses to try, in order, when the plain one is taken. */
export function slugCandidates(base: string, random: () => string): string[] {
  const root = base.slice(0, SLUG_MAX - 5).replace(/-+$/g, "") || "group";
  return [base, ...[2, 3, 4, 5].map((n) => `${root}-${n}`), `${root}-${random()}`];
}
