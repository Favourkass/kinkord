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

/** An @handle as written (lowercased, without the @) and the member the API says it names. */
export interface MentionPM {
  handle: string;
  username: string;
}

/**
 * A post's or comment's text as plain text and links: each @handle links to
 * the member the API says it names, exactly as the API read it; the rest is
 * text. A member named without the full stop that ended the sentence links
 * without it.
 */
export function bodyParts(
  body: string,
  mentions: MentionPM[] | undefined,
  memberHref: (username: string) => string,
): BodyPart[] {
  if (!body) return [];
  const named = new Map((mentions ?? []).map((m) => [m.handle, m.username]));
  if (!named.size) return [{ text: body }];
  const parts: BodyPart[] = [];
  let shown = 0;
  for (const match of body.matchAll(MENTION)) {
    const written = match[2];
    const username = named.get(written.toLowerCase());
    // The member's name is the handle, or its start (before a full stop).
    if (!username || !written.toLowerCase().startsWith(username)) continue;
    const at = (match.index ?? 0) + match[1].length;
    if (at > shown) parts.push({ text: body.slice(shown, at) });
    const handle = written.slice(0, username.length);
    parts.push({ mention: `@${handle}`, href: memberHref(username) });
    shown = at + 1 + handle.length;
  }
  if (shown < body.length) parts.push({ text: body.slice(shown) });
  return parts;
}

/**
 * The parts within the text's first `length` characters. A mention cut short
 * there is text: what's left of it may be someone else's handle.
 */
export function clipParts(parts: BodyPart[], length: number): BodyPart[] {
  const clipped: BodyPart[] = [];
  let room = length;
  for (const part of parts) {
    if (room <= 0) break;
    const text = "mention" in part ? part.mention : part.text;
    clipped.push(text.length <= room ? part : { text: text.slice(0, room) });
    room -= text.length;
  }
  return clipped;
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
