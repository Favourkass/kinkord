/**
 * Members directory + public member profile. PMs mirror the API payloads
 * (the source of truth we fetch/persist); `toVM` shapes them for display.
 * Age and presence arrive pre-computed from the API so a member's birth date
 * never leaves the server and online/offline is decided in one place.
 */
import {
  capitalize,
  compactNumber,
  countryName,
  displayState,
  genderInitial,
  monthYear,
  shortDate,
  timeAgo,
} from "@/util/format";

export interface MemberCardPM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  age: number | null;
  gender: string | null;
  /** Kink roles ("Submissive", "Switch"…) — shown on the card instead of gender (CEO, 2026-09-08). */
  roles: string[];
  city: string | null;
  state: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  postsCount: number;
  followersCount: number;
  isFollowing: boolean;
}

export interface MemberCardVM {
  userId: string;
  username: string | null;
  /** Card title: the handle per the kinksters brief, falling back to display name. */
  title: string;
  avatarUrl: string | null;
  /** "19F" — age plus sex initial; null when the age is unknown. */
  ageTag: string | null;
  /** "Submissive | Switch" — roles joined like the profile tag line; null when none. */
  roles: string | null;
  /** "Abraka, Delta State" or null when nothing is known. */
  location: string | null;
  isOnline: boolean;
  posts: string;
  followers: string;
  isFollowing: boolean;
}

export function toMemberCardVM(pm: MemberCardPM): MemberCardVM {
  const ageTag = pm.age === null ? null : `${pm.age}${genderInitial(pm.gender)}`;
  const roles = pm.roles.length > 0 ? pm.roles.join(" | ") : null;
  const location = [pm.city, displayState(pm.state)].filter(Boolean).join(", ") || null;
  return {
    userId: pm.userId,
    username: pm.username,
    title: pm.username ?? pm.displayName,
    avatarUrl: pm.avatarUrl,
    ageTag,
    roles,
    location,
    isOnline: pm.isOnline,
    posts: compactNumber(pm.postsCount),
    followers: compactNumber(pm.followersCount),
    isFollowing: pm.isFollowing,
  };
}

export interface PublicProfilePM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  age: number | null;
  gender: string | null;
  orientation: string | null;
  relationshipStatus: string | null;
  bodyType: string | null;
  roles: string[];
  interests: string[];
  lookingFor: string[];
  languages: string[];
  joinedAt: string;
  lastSeenAt: string | null;
  isOnline: boolean;
  counts: { friends: number; followers: number; following: number; mutualFriends: number };
  isFollowing: boolean;
  isSelf: boolean;
  /** About cards (Edit Profile fields, 2026-09-12). */
  nationality: string | null;
  occupation: string | null;
  limits: string | null;
  socialLinks: { facebook?: string | null; x?: string | null };
  /** Friends-only profile seen by a non-friend: About details withheld. */
  restricted: boolean;
  /** Only your own profile carries the birth date. */
  dateOfBirth: string | null;
  verification: { email: boolean; phone: boolean };
}

export type SocialPlatform = "facebook" | "x";

export interface SocialLinkVM {
  platform: SocialPlatform;
  url: string;
  /** "@naughty_neze" — the last path segment of the link. */
  handle: string;
}

/** One tile of the Media tab (profile photos / covers now, post media later). */
export interface MediaItemPM {
  id: string;
  kind: "avatar" | "cover" | "photo" | "video";
  /** Grid size. */
  url: string;
  /** Original, for the lightbox. */
  fullUrl: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface MediaPagePM {
  items: MediaItemPM[];
  total: number;
  page: number;
  limit: number;
  restricted: boolean;
}

export interface MediaTileVM {
  id: string;
  kind: MediaItemPM["kind"];
  url: string;
  fullUrl: string;
  /** The current profile photo gets the 2-column "Featured" tile (Figma 1524:1786). */
  featured: boolean;
  isCurrent: boolean;
}

export interface PublicProfileVM {
  userId: string;
  username: string | null;
  displayName: string;
  /** "@nene" or null when the member has no handle. */
  handle: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  isOnline: boolean;
  /** Relative "an hour ago" for the "Last seen …" line; null when never seen. */
  lastSeenAgo: string | null;
  stats: { friends: string; followers: string; following: string; mutualFriends: string };
  /** "Abraka, Delta State, Nigeria" */
  locationLine: string | null;
  /** "25F · Dominant | Sadist" */
  tagLine: string | null;
  bio: string | null;
  basic: {
    age: string | null;
    gender: string | null;
    orientation: string | null;
    relationshipStatus: string | null;
    bodyType: string | null;
  };
  interests: string[];
  lookingFor: string[];
  /** "English, Pidgin" */
  languages: string | null;
  /** "March 2023" */
  joined: string | null;
  /** "25 May 2025" — the exact join date (CEO, 2026-09-12). */
  memberSince: string | null;
  isFollowing: boolean;
  isSelf: boolean;
  /** About → Personal Information rows (Figma 1256:800), display-ready. */
  personal: {
    age: string | null;
    /** "14 February 2001"; only on your own profile. */
    dateOfBirth: string | null;
    gender: string | null;
    /** "Abraka, Delta State" */
    location: string | null;
    relationshipStatus: string | null;
    nationality: string | null;
    occupation: string | null;
    languages: string | null;
  };
  roles: string[];
  limits: string | null;
  socialLinks: SocialLinkVM[];
  verification: { level: "basic" | "none"; email: boolean; phone: boolean };
  restricted: boolean;
}

/** "https://x.com/naughty_neze/" -> "@naughty_neze"; falls back to the host. */
export function socialHandle(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last ? `@${last.replace(/^@/, "")}` : u.host;
  } catch {
    return url;
  }
}

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Grid tiles: the current profile photo is the featured 2-column tile. */
export function toMediaTiles(items: MediaItemPM[]): MediaTileVM[] {
  return items.map((m) => ({
    id: m.id,
    kind: m.kind,
    url: m.url,
    fullUrl: m.fullUrl,
    featured: m.kind === "avatar" && m.isCurrent,
    isCurrent: m.isCurrent,
  }));
}

export function toPublicProfileVM(pm: PublicProfilePM, now = new Date()): PublicProfileVM {
  const ageTag = pm.age === null ? "" : `${pm.age}${genderInitial(pm.gender)}`;
  const rolesTag = pm.roles.join(" | ");
  const tagLine = [ageTag, rolesTag].filter(Boolean).join(" · ") || null;
  const locationLine =
    [pm.city, displayState(pm.state), countryName(pm.country)].filter(Boolean).join(", ") || null;
  return {
    userId: pm.userId,
    username: pm.username,
    displayName: pm.displayName,
    handle: pm.username ? `@${pm.username}` : null,
    avatarUrl: pm.avatarUrl,
    coverUrl: pm.coverUrl,
    isOnline: pm.isOnline,
    lastSeenAgo: timeAgo(pm.lastSeenAt, now),
    stats: {
      friends: compactNumber(pm.counts.friends),
      followers: compactNumber(pm.counts.followers),
      following: compactNumber(pm.counts.following),
      mutualFriends: compactNumber(pm.counts.mutualFriends),
    },
    locationLine,
    tagLine,
    bio: pm.bio,
    basic: {
      age: pm.age === null ? null : String(pm.age),
      gender: pm.gender,
      orientation: pm.orientation,
      relationshipStatus: pm.relationshipStatus,
      bodyType: pm.bodyType,
    },
    interests: pm.interests,
    lookingFor: pm.lookingFor,
    languages: pm.languages.length > 0 ? pm.languages.join(", ") : null,
    joined: monthYear(pm.joinedAt),
    memberSince: shortDate(pm.joinedAt),
    isFollowing: pm.isFollowing,
    isSelf: pm.isSelf,
    personal: {
      age: pm.age === null ? null : String(pm.age),
      dateOfBirth: longDate(pm.dateOfBirth),
      gender: capitalize(pm.gender) || null,
      location: [pm.city, displayState(pm.state)].filter(Boolean).join(", ") || null,
      relationshipStatus: pm.relationshipStatus,
      nationality: countryName(pm.nationality),
      occupation: pm.occupation,
      languages: pm.languages.length > 0 ? pm.languages.join(", ") : null,
    },
    roles: pm.roles,
    limits: pm.limits,
    socialLinks: (["facebook", "x"] as const).flatMap((platform) => {
      const url = pm.socialLinks?.[platform];
      return url ? [{ platform, url, handle: socialHandle(url) }] : [];
    }),
    verification: {
      level: pm.verification?.email || pm.verification?.phone ? "basic" : "none",
      email: Boolean(pm.verification?.email),
      phone: Boolean(pm.verification?.phone),
    },
    restricted: Boolean(pm.restricted),
  };
}

/* ---- Row view-models shared by the members screens and their presenters ---- */

/** Country picker row (Figma 881:730). */
export interface CountryRowVM {
  code: string;
  name: string;
  flag: string | null;
  emoji: string;
  /** "12.4K Members" for launched countries; null for coming-soon ones. */
  membersLabel: string | null;
  comingSoon: boolean;
  href: string | null;
}

/** State picker radio row (Figma 886:1076). */
export interface StateRowVM {
  state: string;
  /** "950" */
  count: string;
  selected: boolean;
}

/** Members-list row: the card plus its navigation/loading state (Figma 907:1410). */
export interface RegionRowVM {
  card: MemberCardVM;
  href: string;
  openProfileLabel: string;
  busy: boolean;
}

/** Friends-tab row (Figma 926:818). */
export interface FriendRowVM {
  userId: string;
  username: string | null;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
  busy: boolean;
}
