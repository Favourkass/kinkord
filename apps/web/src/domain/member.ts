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
  /** "25F • Female" — whichever parts are known. */
  meta: string;
  /** "Abraka, Delta State" or null when nothing is known. */
  location: string | null;
  isOnline: boolean;
  posts: string;
  followers: string;
  isFollowing: boolean;
}

export function toMemberCardVM(pm: MemberCardPM): MemberCardVM {
  const ageTag = pm.age === null ? "" : `${pm.age}${genderInitial(pm.gender)}`;
  const meta = [ageTag, pm.gender].filter(Boolean).join(" • ");
  const location = [pm.city, displayState(pm.state)].filter(Boolean).join(", ") || null;
  return {
    userId: pm.userId,
    username: pm.username,
    title: pm.username ?? pm.displayName,
    avatarUrl: pm.avatarUrl,
    meta,
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
  counts: { friends: number; followers: number; following: number };
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
  stats: { friends: string; followers: string; following: string };
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
