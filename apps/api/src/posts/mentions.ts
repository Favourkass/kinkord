import { and, inArray } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { user } from "../db/schema";
import { notBanned } from "../moderation/admins";

/**
 * "@ada" in a post or a comment: at the start, or after anything that can't be
 * part of a handle (so an email address mentions nobody). The handle is the
 * whole word, so a longer one never mentions whoever its first 30 characters
 * name.
 */
const MENTION = /(^|[^A-Za-z0-9_.@])@([A-Za-z0-9_.]{3,})/g;

/** The most members one post or comment tells it mentioned them. */
export const MAX_MENTIONS = 10;

/** An @handle as written (lowercased, without the @) and the member it names. */
export interface Mention {
  handle: string;
  username: string;
}

/**
 * The most different @handles looked at in one post or comment: room for ten
 * members among other words. It bounds the lookup, which a long post full of
 * handles would otherwise grow past what one query can ask (and fail the page).
 */
export const MAX_HANDLES = 30;

/** Long enough and short enough for a username: 3–30 characters (USERNAME_RE). */
const usernameLength = (name: string) => name.length >= 3 && name.length <= 30;

/**
 * Without the full stops that may have ended the sentence. A loop, not
 * /\.+$/: that pattern takes quadratic time on a long run of dots.
 */
function withoutFullStop(handle: string): string {
  let end = handle.length;
  while (end > 0 && handle[end - 1] === ".") end--;
  return handle.slice(0, end);
}

/**
 * Each different @handle, the first thirty: the word written, lowercased
 * (usernames are stored so), and as a username: as written and without a
 * trailing full stop, each only when it's a username's length. A word no
 * username could be isn't a handle.
 */
function handlesIn(
  text: string | null | undefined,
): Array<{ word: string; full: string | null; short: string | null }> {
  if (!text) return [];
  const handles = new Map<string, { word: string; full: string | null; short: string | null }>();
  for (const m of text.matchAll(MENTION)) {
    const word = m[2].toLowerCase();
    if (handles.has(word)) continue;
    const short = withoutFullStop(word);
    const handle = {
      word,
      full: usernameLength(word) ? word : null,
      short: usernameLength(short) ? short : null,
    };
    if (!handle.full && !handle.short) continue;
    handles.set(word, handle);
    if (handles.size === MAX_HANDLES) break;
  }
  return [...handles.values()];
}

/** Every username a text could be mentioning: what to look up. */
export function mentionCandidates(text: string | null | undefined): string[] {
  const names = new Set<string>();
  for (const { full, short } of handlesIn(text)) {
    if (full) names.add(full);
    if (short) names.add(short);
  }
  return [...names];
}

/**
 * Whom each handle in a text names, given which usernames are members: the
 * handle as written when that's a member (a username may end in a dot), else
 * without the full stop that ended the sentence. Every handle looked at, so a
 * reader links each exactly as here and never has to guess at one.
 */
export function mentionsIn(
  text: string | null | undefined,
  members: { has(name: string): boolean },
): Mention[] {
  const found: Mention[] = [];
  for (const { word, full, short } of handlesIn(text)) {
    const username = full && members.has(full) ? full : short && members.has(short) ? short : null;
    if (username) found.push({ handle: word, username });
  }
  return found;
}

/** The members to tell they were mentioned: each once, the first ten. */
export function membersToTell(mentions: Mention[]): string[] {
  return [...new Set(mentions.map((m) => m.username))].slice(0, MAX_MENTIONS);
}

/** Which of these usernames belong to members who can be shown, with their ids. No query for none. */
export async function knownHandles(db: Db, names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names)];
  if (!unique.length) return new Map();
  const rows = await db
    .select({ username: user.username, id: user.id })
    .from(user)
    .where(and(inArray(user.username, unique), notBanned(user.id)));
  return new Map(
    rows
      .filter((r): r is { username: string; id: string } => Boolean(r.username))
      .map((r) => [r.username, r.id]),
  );
}
