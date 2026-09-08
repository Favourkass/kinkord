/**
 * Members directory + public member profile. PMs mirror the API payloads
 * (the source of truth we fetch/persist); `toVM` shapes them for display.
 * Age and presence arrive pre-computed from the API so a member's birth date
 * never leaves the server and online/offline is decided in one place.
 */
import {
  compactNumber,
  countryName,
  displayState,
  genderInitial,
  monthYear,
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
  isFollowing: boolean;
  isSelf: boolean;
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
    isFollowing: pm.isFollowing,
    isSelf: pm.isSelf,
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
