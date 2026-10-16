import { isSuperAdmin } from "../moderation/admins";
import { SILVER_NEW_CHATS_PER_DAY } from "../subscriptions/plans";

/**
 * New chats a member may start per day. A new chat is a first message in a
 * thread nobody has written in yet; replies and follow-ups in chats that
 * already have messages don't count. This is the free allowance; Silver
 * raises it to SILVER_NEW_CHATS_PER_DAY.
 */
export const FREE_NEW_CHATS_PER_DAY = 1;

/** The error code the web app reads to explain the limit. */
export const NEW_CHAT_LIMIT = "NEW_CHAT_LIMIT";

/** Days roll over at midnight in Lagos, which is UTC+1 all year. */
const LAGOS_UTC_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Lagos calendar day `now` falls in, as UTC instants. */
export function chatDay(now: Date): { start: Date; end: Date } {
  const local = now.getTime() + LAGOS_UTC_OFFSET_MS;
  const start = Math.floor(local / DAY_MS) * DAY_MS - LAGOS_UTC_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + DAY_MS) };
}

/** New chats this member may start per day; null means no limit (the super admins). */
export function newChatsPerDay(
  who: { email: string; emailVerified: boolean },
  silver = false,
): number | null {
  if (isSuperAdmin(who)) return null;
  return silver ? SILVER_NEW_CHATS_PER_DAY : FREE_NEW_CHATS_PER_DAY;
}
