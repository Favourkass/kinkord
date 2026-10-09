/**
 * @mentions in posts and comments, with the API's own handle rule: "@ada" at
 * the start, or after anything that can't be part of a handle (so an email
 * address mentions nobody), the whole word; usernames are 3–30 letters,
 * digits, underscores and dots.
 */
import type { MemberCardPM } from "./member";

const MENTION = /(^|[^A-Za-z0-9_.@])@([A-Za-z0-9_.]{3,})/g;
/** "@que" being typed right up to the caret; the query may still be empty. */
const TYPING = /(^|[^A-Za-z0-9_.@])@([A-Za-z0-9_.]{0,30})$/;

export type BodyPart = { text: string } | { mention: string; href: string };

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
 * A post's or comment's text as plain text and links: each @handle the API
 * confirmed is a member links to their profile, as typed; the rest is text.
 * Like the API, a handle as written wins when it's a member (a username may
 * end in a dot); otherwise a full stop ending the sentence isn't part of it.
 */
export function bodyParts(
  body: string,
  mentions: string[] | undefined,
  memberHref: (username: string) => string,
): BodyPart[] {
  const known = new Set((mentions ?? []).map((m) => m.toLowerCase()));
  if (!body) return [];
  if (!known.size) return [{ text: body }];
  const parts: BodyPart[] = [];
  let shown = 0;
  for (const match of body.matchAll(MENTION)) {
    const full = match[2];
    const short = withoutFullStop(full);
    const handle = known.has(full.toLowerCase())
      ? full
      : known.has(short.toLowerCase())
        ? short
        : null;
    if (!handle) continue;
    const at = (match.index ?? 0) + match[1].length;
    if (at > shown) parts.push({ text: body.slice(shown, at) });
    parts.push({ mention: `@${handle}`, href: memberHref(handle.toLowerCase()) });
    shown = at + 1 + handle.length;
  }
  if (shown < body.length) parts.push({ text: body.slice(shown) });
  return parts;
}

export interface MentionAt {
  /** Where the "@" is. */
  start: number;
  /** What's typed after it, up to the caret. */
  query: string;
}

/** The "@que" being typed at the caret, if that's what's happening. */
export function mentionAt(text: string, caret: number): MentionAt | null {
  const match = TYPING.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2] };
}

/**
 * The text with the handle being typed swapped for "@username ", and the caret
 * after it. The whole handle goes, even the part past the caret (picking at
 * "@ad|rian" leaves no "rian").
 */
export function insertMention(
  text: string,
  at: MentionAt,
  username: string,
): { text: string; caret: number } {
  const inserted = `@${username} `;
  const rest = text
    .slice(at.start + 1 + at.query.length)
    .replace(/^[A-Za-z0-9_.]*/, "")
    .replace(/^ /, "");
  return { text: text.slice(0, at.start) + inserted + rest, caret: at.start + inserted.length };
}

export interface MentionSuggestionVM {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  silver: boolean;
}

/** A member to suggest while "@" is typed; only someone with a username can be mentioned. */
export function toMentionSuggestionVM(pm: MemberCardPM): MentionSuggestionVM | null {
  if (!pm.username) return null;
  return {
    userId: pm.userId,
    username: pm.username,
    name: pm.displayName || pm.username,
    avatarUrl: pm.avatarUrl,
    silver: Boolean(pm.silver),
  };
}
