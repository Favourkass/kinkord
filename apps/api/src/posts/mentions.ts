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

/**
 * The most full stops after a handle tried one at a time as the sentence's,
 * between taking none and taking them all: room for "." and "...", and few
 * names to look up per handle.
 */
const MAX_STOPS = 3;

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
 * The usernames a written handle could be, longest first. A username may end
 * in dots of its own, so the dots after it may be its own or the sentence's:
 * as written, then with each of up to three taken as the sentence's, then with
 * all of them taken so ("@ada.." is "ada." or "ada"). Only a username's length
 * counts.
 */
function usernamesFor(word: string): string[] {
  const names = [word];
  let cut = word;
  for (let stops = 0; stops < MAX_STOPS && cut.endsWith("."); stops++) {
    cut = cut.slice(0, -1);
    names.push(cut);
  }
  names.push(withoutFullStop(word));
  return [...new Set(names)].filter(usernameLength);
}

/**
 * Each different @handle, the first thirty: the word written, lowercased
 * (usernames are stored so), and the usernames it could be. A word no
 * username could be isn't a handle.
 */
function handlesIn(text: string | null | undefined): Array<{ word: string; names: string[] }> {
  if (!text) return [];
  const handles = new Map<string, { word: string; names: string[] }>();
  for (const m of text.matchAll(MENTION)) {
    const word = m[2].toLowerCase();
    if (handles.has(word)) continue;
    const names = usernamesFor(word);
    if (!names.length) continue;
    handles.set(word, { word, names });
    if (handles.size === MAX_HANDLES) break;
  }
  return [...handles.values()];
}

/** Every username a text could be mentioning: what to look up. */
export function mentionCandidates(text: string | null | undefined): string[] {
  return [...new Set(handlesIn(text).flatMap((h) => h.names))];
}

/**
 * Whom each handle in a text names, given which usernames are members: the
 * longest username it could be that's a member, so "@ada.." names "ada." when
 * there is one, the sentence's full stop left over. Every handle looked at, so
 * a reader links each exactly as here and never has to guess at one.
 */
export function mentionsIn(
  text: string | null | undefined,
  members: { has(name: string): boolean },
): Mention[] {
  const found: Mention[] = [];
  for (const { word, names } of handlesIn(text)) {
    const username = names.find((name) => members.has(name));
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
