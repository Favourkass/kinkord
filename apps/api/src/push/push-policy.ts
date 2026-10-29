import type { NotificationType } from "../db/schema";

/**
 * When a notification reaches a member's devices (founder's decisions,
 * 2026-10-26). The inbox always gets it at once; this only decides the push:
 *
 * - Messages, comments, mentions, tags, friend and relationship requests and
 *   account notices go at once.
 * - Likes, reposts and follows are bundled: the first one goes at once, then
 *   at most one push per type every two hours, saying how many ("Ada and 6
 *   others liked your posts"), and no more than eight of these a day.
 * - From 11pm to 7am in the member's own time only messages go; the rest wait
 *   for a summary in the morning.
 * - Moderators' alerts and the push test always go at once.
 * - A kind the member turned off in Settings stays in the inbox, unpushed.
 */

/** The switches in Settings → Notifications. */
export const PUSH_GROUPS = ["messages", "comments", "tags", "friends", "likes", "follows"] as const;
export type PushGroup = (typeof PUSH_GROUPS)[number];

const GROUP_OF: Partial<Record<NotificationType, PushGroup>> = {
  message: "messages",
  comment: "comments",
  mention: "comments",
  tag: "tags",
  friend_request: "friends",
  friend_accepted: "friends",
  relationship_request: "friends",
  relationship_accepted: "friends",
  like: "likes",
  repost: "likes",
  follow: "follows",
};

/** The member's switch for this type; null when no switch covers it (account notices, staff alerts). */
export function groupOf(type: NotificationType): PushGroup | null {
  return GROUP_OF[type] ?? null;
}

/** Moderators must hear of reports at once, and the test shows notifications work. */
const ALWAYS_NOW: ReadonlySet<NotificationType> = new Set([
  "report",
  "payment",
  "silver_check",
  "verification",
  "verification_underage",
  "test",
]);

export const BUNDLED_TYPES: ReadonlySet<NotificationType> = new Set(["like", "repost", "follow"]);
export const BUNDLE_WINDOW_MINUTES = 120;
export const DAILY_BUNDLED_CAP = 8;
/** Quiet hours, in the member's local time: from 23:00 until 07:00. */
export const QUIET_FROM_HOUR = 23;
export const QUIET_UNTIL_HOUR = 7;
/** A held push older than this is stale; the inbox still has it. */
export const HOLD_EXPIRY_HOURS = 48;

const COUNTRY_ZONES: Record<string, string> = {
  NG: "Africa/Lagos",
  GH: "Africa/Accra",
  KE: "Africa/Nairobi",
};
const US_ZONES: Record<string, string[]> = {
  "America/Chicago": [
    "Alabama",
    "Arkansas",
    "Illinois",
    "Iowa",
    "Kansas",
    "Louisiana",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Nebraska",
    "North Dakota",
    "Oklahoma",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Wisconsin",
  ],
  "America/Denver": ["Colorado", "Idaho", "Montana", "New Mexico", "Utah", "Wyoming"],
  "America/Phoenix": ["Arizona"],
  "America/Los_Angeles": ["California", "Nevada", "Oregon", "Washington"],
  "America/Anchorage": ["Alaska"],
  "Pacific/Honolulu": ["Hawaii"],
};
const US_STATE_ZONE = new Map(
  Object.entries(US_ZONES).flatMap(([zone, states]) => states.map((s) => [s, zone] as const)),
);

/**
 * The member's time zone from their profile. A US state outside the map is on
 * Eastern time; with no country we use Lagos, where most members are.
 */
export function timeZoneOf(country: string | null, state: string | null): string {
  if (country === "US") return US_STATE_ZONE.get(state ?? "") ?? "America/New_York";
  return COUNTRY_ZONES[country ?? ""] ?? "Africa/Lagos";
}

export function localHour(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" })
    .formatToParts(now)
    .find((p) => p.type === "hour")?.value;
  return Number(hour);
}

export function isQuietHours(now: Date, timeZone: string): boolean {
  const hour = localHour(now, timeZone);
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

export interface PushContext {
  type: NotificationType;
  now: Date;
  timeZone: string;
  /** Groups the member turned off. */
  off: ReadonlySet<string>;
  /** The last push of this type to the member, if any. */
  lastSentOfType: Date | null;
  /** Bundled pushes sent to the member in the last 24 hours. */
  bundledSentToday: number;
}

export type PushDecision = "send" | "hold" | "drop";

export function decidePush(ctx: PushContext): PushDecision {
  if (ALWAYS_NOW.has(ctx.type)) return "send";
  const group = groupOf(ctx.type);
  if (group && ctx.off.has(group)) return "drop";
  if (ctx.type === "message") return "send";
  if (isQuietHours(ctx.now, ctx.timeZone)) return "hold";
  if (!BUNDLED_TYPES.has(ctx.type)) return "send";
  if (ctx.bundledSentToday >= DAILY_BUNDLED_CAP) return "hold";
  const windowMs = BUNDLE_WINDOW_MINUTES * 60_000;
  if (ctx.lastSentOfType && ctx.now.getTime() - ctx.lastSentOfType.getTime() < windowMs) {
    return "hold";
  }
  return "send";
}

/** What a held type says, for one event and for several: who, never what. */
const SAYS: Partial<Record<NotificationType, [one: string, many: string]>> = {
  like: ["liked your post", "liked your posts"],
  repost: ["shared your post", "shared your posts"],
  follow: ["followed you", "followed you"],
  comment: ["commented on your post", "commented on your posts"],
  mention: ["mentioned you", "mentioned you"],
  tag: ["tagged you in a post", "tagged you in posts"],
  friend_request: ["sent you a friend request", "sent you friend requests"],
  friend_accepted: ["accepted your friend request", "accepted your friend requests"],
  relationship_request: [
    "wants to link a relationship with you",
    "want to link a relationship with you",
  ],
  relationship_accepted: [
    "accepted your relationship request",
    "accepted your relationship requests",
  ],
  kink_ring: ["gave you a Kink Ring", "gave you Kink Rings"],
};
/** Account notices have no actor; held through the night, they say what they always say. */
const ACCOUNT_SAYS: Partial<Record<NotificationType, string>> = {
  payment_verified: "Your Silver Premium is active",
  payment_rejected: "We couldn't confirm your payment",
  verification_update: "Your identity verification has an update",
};

/**
 * One push for everything held of one type. `names` are the actors, most
 * recent first and without repeats; `events` counts the held rows; `subjects`
 * are the distinct things they're about.
 */
export function digestBody(
  type: NotificationType,
  names: readonly string[],
  events: number,
  subjects: number,
): string {
  const account = ACCOUNT_SAYS[type];
  if (account) return account;
  const [one, many] = SAYS[type] ?? ["sent you a notification", "sent you notifications"];
  const what = events > 1 && subjects > 1 ? many : one;
  const first = names[0] ?? "Someone";
  if (names.length <= 1) return `${first} ${what}`;
  const others = names.length - 1;
  // "want" agrees with a plural subject: "Ada and 2 others want to link…".
  const verb = what.startsWith("wants ") ? what.replace(/^wants /, "want ") : what;
  return `${first} and ${others} ${others === 1 ? "other" : "others"} ${verb}`;
}
