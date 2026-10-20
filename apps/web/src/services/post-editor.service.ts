import type { PostTextFormat, DraftSelection, DraftEdit } from "@/domain/text-format";
const markers: Record<PostTextFormat, string> = { bold: "**", italic: "*", underline: "__" };
const range = (text: string, selection: DraftSelection) => ({
  start: Math.max(0, Math.min(text.length, selection.start)),
  end: Math.max(0, Math.min(text.length, Math.max(selection.start, selection.end))),
});

/** Toggle a format around the selection, preserving the caret and the post limit. */
export function formatPostDraft(
  text: string,
  selection: DraftSelection,
  format: PostTextFormat,
  limit: number,
): DraftEdit | null {
  const { start, end } = range(text, selection);
  const marker = markers[format];
  const n = marker.length;
  if (start >= n && text.slice(start - n, start) === marker && text.slice(end, end + n) === marker)
    return {
      text: text.slice(0, start - n) + text.slice(start, end) + text.slice(end + n),
      selection: { start: start - n, end: end - n },
    };
  const selected = text.slice(start, end);
  if (selected.length >= n * 2 && selected.startsWith(marker) && selected.endsWith(marker))
    return {
      text: text.slice(0, start) + selected.slice(n, -n) + text.slice(end),
      selection: { start, end: end - n * 2 },
    };
  if (text.length + n * 2 > limit) return null;
  return {
    text: text.slice(0, start) + marker + selected + marker + text.slice(end),
    selection: { start: start + n, end: end + n },
  };
}
export function insertPostText(
  text: string,
  selection: DraftSelection,
  inserted: string,
  limit: number,
): DraftEdit | null {
  const { start, end } = range(text, selection);
  const next = text.slice(0, start) + inserted + text.slice(end);
  if (next.length > limit) return null;
  return {
    text: next,
    selection: { start: start + inserted.length, end: start + inserted.length },
  };
}
