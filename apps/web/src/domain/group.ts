/**
 * Groups. PMs mirror the API (groups.service.ts); the functions shape them for
 * the screens, with the copy handed in so the rules stay testable on their own.
 */
import type { PostPM } from "./post";

export type GroupCategory =
  "local" | "interests" | "lifestyle" | "identity" | "education" | "social" | "official";
export type GroupPrivacy = "open" | "closed";
export type GroupRole = "owner" | "moderator" | "member";
export type GroupMemberStatus = "active" | "pending";
export type GroupsView = "mine" | "near" | "popular" | "new";
export type GroupTab = "discussions" | "about" | "members" | "requests";
export const GROUPS_VIEWS: GroupsView[] = ["mine", "near", "popular", "new"];

export interface GroupSummaryPM {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: GroupCategory;
  privacy: GroupPrivacy;
  country: string | null;
  state: string | null;
  members: number;
  /** The viewer's place in it, null when they're not in it. */
  role: GroupRole | null;
  status: GroupMemberStatus | null;
}

export interface GroupPersonPM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: GroupRole;
  silver: boolean;
  teamMember: boolean;
}

export interface GroupAccessPM {
  member: boolean;
  pending: boolean;
  canRead: boolean;
  canPost: boolean;
  canModerate: boolean;
  isOwner: boolean;
}

export interface GroupPM extends GroupSummaryPM {
  rules: string | null;
  createdAt: string;
  /** The owner first, then the moderators. */
  team: GroupPersonPM[];
  access: GroupAccessPM;
  /** Waiting to join; moderators only. */
  requests: number | null;
}

export interface GroupMemberPM extends GroupPersonPM {
  status: GroupMemberStatus;
  since: string;
}

export interface GroupsPagePM {
  items: GroupSummaryPM[];
  hasMore: boolean;
  hint?: "no_location";
}

export interface GroupMembersPagePM {
  items: GroupMemberPM[];
  hasMore: boolean;
}

export interface GroupOptionsPM {
  categories: GroupCategory[];
  canCreate: boolean;
  refusal: "silver" | "new_account" | "limit" | null;
  refusalMessage: string | null;
}

export interface GroupThreadPM {
  group: GroupPM;
  thread: PostPM;
}

/** A row of a profile's "Groups & Communities" card. */
export interface ProfileGroupPM {
  slug: string;
  name: string;
  role: GroupRole;
  members: number;
}

export interface GroupInputPM {
  name: string;
  description: string;
  rules: string | null;
  category: GroupCategory;
  privacy: GroupPrivacy;
  country: string | null;
  state: string | null;
}

export interface GroupLabels {
  categories: Record<GroupCategory, string>;
  privacy: Record<GroupPrivacy, string>;
  roles: Record<GroupRole, string>;
  requested: string;
  members: (n: number) => string;
}

export interface GroupRowVM {
  slug: string;
  href: string;
  name: string;
  description: string;
  /** "Local & meetups · Lagos, Nigeria · 12 members". */
  meta: string;
  privacy: string;
  closed: boolean;
  /** The viewer's place in it: "Owner", "Member", "Requested"; null when not in it. */
  badge: string | null;
}

/** "Lagos, Nigeria", "Nigeria", or null for a group about an interest. */
export function placeLabel(
  state: string | null,
  country: string | null,
  countryName: (code: string | null) => string | null,
): string | null {
  const nation = countryName(country);
  if (state && nation) return `${state}, ${nation}`;
  return state ?? nation ?? null;
}

export function groupBadge(
  pm: Pick<GroupSummaryPM, "role" | "status">,
  labels: Pick<GroupLabels, "roles" | "requested">,
): string | null {
  if (pm.status === "pending") return labels.requested;
  if (pm.status === "active" && pm.role) return labels.roles[pm.role];
  return null;
}

export function toGroupRowVM(
  pm: GroupSummaryPM,
  labels: GroupLabels,
  href: string,
  countryName: (code: string | null) => string | null,
): GroupRowVM {
  return {
    slug: pm.slug,
    href,
    name: pm.name,
    description: pm.description,
    meta: [
      labels.categories[pm.category],
      placeLabel(pm.state, pm.country, countryName),
      labels.members(pm.members),
    ]
      .filter(Boolean)
      .join(" · "),
    privacy: labels.privacy[pm.privacy],
    closed: pm.privacy === "closed",
    badge: groupBadge(pm, labels),
  };
}

export type GroupAction = "join" | "ask" | "cancel" | "leave";

/**
 * The one button beside a group's name: join (or ask, for a closed group),
 * take back a request, or leave. The owner gets none: they close the group
 * down instead of leaving it.
 */
export function primaryAction(access: GroupAccessPM, privacy: GroupPrivacy): GroupAction | null {
  if (access.isOwner) return null;
  if (access.member) return "leave";
  if (access.pending) return "cancel";
  return privacy === "open" ? "join" : "ask";
}

/** Requests exist only in closed groups, and only moderators see them. */
export function groupTabs(access: GroupAccessPM, privacy: GroupPrivacy): GroupTab[] {
  return [
    "discussions",
    "about",
    ...(access.canRead ? (["members"] as const) : []),
    ...(access.canModerate && privacy === "closed" ? (["requests"] as const) : []),
  ];
}

export const THREAD_TITLE_MIN = 3;
export const THREAD_TITLE_MAX = 120;
export const GROUP_NAME_MIN = 3;
export const GROUP_NAME_MAX = 60;
export const GROUP_DESCRIPTION_MIN = 10;
export const GROUP_DESCRIPTION_MAX = 2000;
export const GROUP_RULES_MAX = 4000;

export function canSubmitThread(title: string, body: string): boolean {
  const t = title.trim().length;
  return t >= THREAD_TITLE_MIN && t <= THREAD_TITLE_MAX && body.trim().length > 0;
}

export type GroupFormErrors = Partial<Record<"name" | "description" | "rules", string>>;

/** What the form says before it sends anything; the API checks the same limits. */
export function groupFormErrors(input: {
  name: string;
  description: string;
  rules: string;
}): GroupFormErrors {
  const errors: GroupFormErrors = {};
  const name = input.name.trim().length;
  if (name < GROUP_NAME_MIN || name > GROUP_NAME_MAX)
    errors.name = `Use ${GROUP_NAME_MIN}–${GROUP_NAME_MAX} characters.`;
  const description = input.description.trim().length;
  if (description < GROUP_DESCRIPTION_MIN || description > GROUP_DESCRIPTION_MAX)
    errors.description = `Use ${GROUP_DESCRIPTION_MIN}–${GROUP_DESCRIPTION_MAX.toLocaleString("en-US")} characters.`;
  if (input.rules.trim().length > GROUP_RULES_MAX)
    errors.rules = `Keep the rules under ${GROUP_RULES_MAX.toLocaleString("en-US")} characters.`;
  return errors;
}

export interface ThreadRowVM {
  id: string;
  href: string;
  title: string;
  authorName: string;
  avatarUrl: string | null;
  /** "2 hours ago": the latest reply, or the posting. */
  time: string;
  replies: string;
  excerpt: string;
  pinned: boolean;
  closed: boolean;
}

const EXCERPT_LENGTH = 140;

export function toThreadRowVM(
  pm: PostPM,
  href: string,
  replies: (n: number) => string,
  ago: (iso: string | null | undefined) => string | null,
): ThreadRowVM {
  const body = (pm.body ?? "").replace(/\s+/g, " ").trim();
  return {
    id: pm.id,
    href,
    title: pm.title ?? "",
    authorName: pm.author.displayName,
    avatarUrl: pm.author.avatarUrl,
    time: ago(pm.lastActivityAt ?? pm.createdAt) ?? "",
    replies: replies(pm.comments),
    excerpt:
      body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : body,
    pinned: Boolean(pm.pinned),
    closed: Boolean(pm.closed),
  };
}
