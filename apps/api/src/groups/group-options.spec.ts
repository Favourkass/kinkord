import { describe, expect, it } from "vitest";
import { GROUP_CATEGORIES, slugCandidates, slugify } from "./group-options";

describe("slugify", () => {
  it("makes a readable address from a group's name", () => {
    expect(slugify("Kinkord Lagos")).toBe("kinkord-lagos");
    expect(slugify("  Rope & Shibari — Abuja!! ")).toBe("rope-and-shibari-abuja");
    expect(slugify("Café Société")).toBe("cafe-societe");
  });

  it("falls back when a name has nothing usable, and steers clear of the API's own routes", () => {
    expect(slugify("🔥🔥🔥")).toBe("group");
    expect(slugify("Options")).toBe("options-group");
    expect(slugify("new")).toBe("new-group");
  });

  it("keeps addresses short without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(47)} b`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("slugCandidates", () => {
  it("tries the plain address, then numbered ones, then a random one", () => {
    expect(slugCandidates("lagos-munch", () => "ab12")).toEqual([
      "lagos-munch",
      "lagos-munch-2",
      "lagos-munch-3",
      "lagos-munch-4",
      "lagos-munch-5",
      "lagos-munch-ab12",
    ]);
  });
});

describe("categories", () => {
  it("include Kinkord's own official one", () => {
    expect(GROUP_CATEGORIES).toContain("official");
    expect(GROUP_CATEGORIES).toContain("local");
  });
});
