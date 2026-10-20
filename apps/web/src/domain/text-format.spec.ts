import { describe, expect, it } from "vitest";
import { formattedBodyParts, formattedText } from "./text-format";
import { clipParts } from "./mentions";

describe("safe inline post formatting", () => {
  it("renders double asterisks, italics and underline with line breaks", () => {
    expect(formattedText("**Bold**\n*Italic* and __Underlined__")).toEqual([
      { text: "Bold", marks: { bold: true } },
      { text: "\n" },
      { text: "Italic", marks: { italic: true } },
      { text: " and " },
      { text: "Underlined", marks: { underline: true } },
    ]);
  });
  it("handles nested styles including bold and italic together", () => {
    expect(formattedText("__***Hello***__")).toEqual([
      { text: "Hello", marks: { bold: true, italic: true, underline: true } },
    ]);
    expect(formattedText("*italic **bold** text*")).toEqual([
      { text: "italic ", marks: { italic: true } },
      { text: "bold", marks: { bold: true, italic: true } },
      { text: " text", marks: { italic: true } },
    ]);
  });
  it("keeps unfinished markers, HTML and underscores in names literal", () => {
    const text = "**unfinished @first_name hello_world <img src=x onerror=alert(1)>";
    expect(formattedText(text)).toEqual([{ text }]);
    expect(formattedText("\\*literal\\*")).toEqual([{ text: "*literal*" }]);
  });
  it("retains verified mention links within formatting and clipped styles", () => {
    const parts = formattedBodyParts(
      "**Hi @riley**",
      [{ handle: "riley", username: "riley" }],
      (u) => `/u/${u}`,
    );
    expect(parts).toEqual([
      { text: "Hi ", marks: { bold: true } },
      { mention: "@riley", href: "/u/riley", marks: { bold: true } },
    ]);
    expect(clipParts(parts, 5)).toEqual([
      { text: "Hi ", marks: { bold: true } },
      { text: "@r", marks: { bold: true } },
    ]);
  });
  it("accepts a Silver-length unclosed draft without recursive/backtracking parsing", () => {
    const text = "**x ".repeat(6000);
    expect(
      formattedText(text)
        .map((run) => run.text)
        .join(""),
    ).toBe(text);
  });
});
