import { expect, it } from "vitest";
import { formatPostDraft, insertPostText } from "./post-editor.service";
it.each([
  ["bold", "**Hello**"],
  ["italic", "*Hello*"],
  ["underline", "__Hello__"],
] as const)("toggles %s around selected text and preserves its selection", (format, expected) => {
  const result = formatPostDraft("Hello", { start: 0, end: 5 }, format, 100)!;
  expect(result.text).toBe(expected);
  expect(formatPostDraft(result.text, result.selection, format, 100)?.text).toBe("Hello");
});
it("puts a collapsed caret between formatting markers", () => {
  expect(formatPostDraft("Hi ", { start: 3, end: 3 }, "bold", 100)).toEqual({
    text: "Hi ****",
    selection: { start: 5, end: 5 },
  });
});
it("inserts full emoji at the caret or replaces a selection, without splitting surrogate pairs", () => {
  expect(insertPostText("Hello there", { start: 6, end: 11 }, "🔥", 20)).toEqual({
    text: "Hello 🔥",
    selection: { start: 8, end: 8 },
  });
  expect(insertPostText("Hi", { start: 2, end: 2 }, "🔥", 3)).toBeNull();
});
it("preserves line breaks and refuses formatting beyond the server's character limit", () => {
  expect(formatPostDraft("One\nTwo", { start: 0, end: 7 }, "bold", 11)?.text).toBe("**One\nTwo**");
  expect(formatPostDraft("Hello", { start: 0, end: 5 }, "bold", 8)).toBeNull();
});
