import { bodyParts, type BodyPart, type MentionPM, type TextMarks } from "./mentions";

export interface DraftSelection {
  start: number;
  end: number;
}
export interface DraftEdit {
  text: string;
  selection: DraftSelection;
}

export type PostTextFormat = "bold" | "italic" | "underline";
const kind = (marker: string): PostTextFormat =>
  marker === "**" ? "bold" : marker === "__" ? "underline" : "italic";

/** Small, linear inline grammar. Raw HTML/links are always plain text. */
export function formattedText(text: string): Array<{ text: string; marks?: TextMarks }> {
  const stack: Array<{ at: number; marker: string }> = [];
  const paired = new Map<number, { marker: string; opening: boolean }>();
  const escapes = new Set<number>();
  for (let at = 0; at < text.length;) {
    const c = text[at];
    if (c === "\\" && /[*_\\]/.test(text[at + 1] ?? "")) {
      escapes.add(at);
      at += 2;
      continue;
    }
    if (c !== "*" && c !== "_") {
      at++;
      continue;
    }
    const top = stack[stack.length - 1];
    const tripleClosesSingle = text.slice(at, at + 3) === c.repeat(3) && top?.marker === c;
    const marker = !tripleClosesSingle && text[at + 1] === c ? c + c : c;
    const before = text[at - 1] ?? "";
    const after = text[at + marker.length] ?? "";
    const canClose = /\S/.test(before) && (c !== "_" || !/[\w@.]/.test(after));
    const canOpen = /\S/.test(after) && (c !== "_" || !/[\w@.]/.test(before));
    if (top?.marker === marker && canClose) {
      stack.pop();
      paired.set(top.at, { marker, opening: true });
      paired.set(at, { marker, opening: false });
    } else if (canOpen) stack.push({ at, marker });
    at += marker.length;
  }
  const parts: Array<{ text: string; marks?: TextMarks }> = [];
  const active = { bold: 0, italic: 0, underline: 0 };
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    const marks: TextMarks = {};
    if (active.bold) marks.bold = true;
    if (active.italic) marks.italic = true;
    if (active.underline) marks.underline = true;
    parts.push(Object.keys(marks).length ? { text: buffer, marks } : { text: buffer });
    buffer = "";
  };
  for (let at = 0; at < text.length;) {
    const pair = paired.get(at);
    if (pair) {
      flush();
      active[kind(pair.marker)] += pair.opening ? 1 : -1;
      at += pair.marker.length;
    } else if (escapes.has(at)) {
      buffer += text[at + 1];
      at += 2;
    } else buffer += text[at++];
  }
  flush();
  return parts;
}

/** Markup becomes display-ready spans; verified mentions retain their links. */
export function formattedBodyParts(
  body: string,
  mentions: MentionPM[] | undefined,
  href: (username: string) => string,
): BodyPart[] {
  return formattedText(body).flatMap((run) =>
    bodyParts(run.text, mentions, href).map((part) =>
      run.marks ? { ...part, marks: run.marks } : part,
    ),
  );
}
