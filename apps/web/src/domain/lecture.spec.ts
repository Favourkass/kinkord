import { describe, expect, it } from "vitest";
import { lectureToVM, type Lecture } from "./lecture";

const base: Lecture = {
  id: "1",
  slug: "consent-101",
  title: "Consent 101",
  category: "Consent & Communication",
  body: "First paragraph.\n\nSecond paragraph.\n\n\n\nThird.",
  links: [{ label: "More", url: "https://kinkord.com" }],
  published: true,
  createdAt: "2026-08-22T10:00:00.000Z",
};

describe("lectureToVM", () => {
  it("splits body into trimmed, non-empty paragraphs", () => {
    const vm = lectureToVM(base);
    expect(vm.paragraphs).toEqual(["First paragraph.", "Second paragraph.", "Third."]);
  });

  it("formats the created date as a short en-GB label", () => {
    expect(lectureToVM(base).createdAtLabel).toBe("22 Aug 2026");
  });

  it("preserves PM fields on the VM", () => {
    const vm = lectureToVM(base);
    expect(vm.slug).toBe("consent-101");
    expect(vm.links).toHaveLength(1);
    expect(vm.published).toBe(true);
  });
});
