import { and, inArray } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { user } from "../db/schema";
import { notBanned } from "../moderation/admins";

/**
 * "@ada" in a post or a comment: at the start, or after anything that can't be
 * part of a handle (so an email address mentions nobody). Usernames are 3–30
 * letters, digits, underscores and dots.
 */
const MENTION = /(^|[^A-Za-z0-9_.@])@([A-Za-z0-9_.]{3,30})/g;

/** The most members one post or comment tells it mentioned them. */
export const MAX_MENTIONS = 10;

/** Each @handle as written, lowercased (usernames are stored so), and without a trailing full stop. */
function handlesIn(text: string | null | undefined): Array<{ full: string; short: string }> {
  if (!text) return [];
  return [...text.matchAll(MENTION)].map((m) => {
    const full = m[2].toLowerCase();
    return { full, short: full.replace(/\.+$/, "") };
  });
}

/** Every username a text could be mentioning: what to look up. */
export function mentionCandidates(text: string | null | undefined): string[] {
  const names = new Set<string>();
  for (const { full, short } of handlesIn(text)) {
    names.add(full);
    if (short.length >= 3) names.add(short);
  }
  return [...names];
}

/**
 * The members a text mentions, given which usernames are members: each handle
 * as written when that's a member (a username may end in a dot), else without
 * the full stop that ended the sentence. Once each, the first ten.
 */
export function mentionsIn(
  text: string | null | undefined,
  members: { has(name: string): boolean },
): string[] {
  const found = new Set<string>();
  for (const { full, short } of handlesIn(text)) {
    const name = members.has(full) ? full : members.has(short) ? short : null;
    if (name) found.add(name);
    if (found.size === MAX_MENTIONS) break;
  }
  return [...found];
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
