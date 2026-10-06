import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  const icons = manifest().icons ?? [];

  it("gives the installed app a monochrome icon for its status-bar notifications", () => {
    const monochrome = icons.filter((icon) => icon.purpose === "monochrome");
    expect(monochrome.map((icon) => icon.sizes)).toEqual(["96x96", "192x192"]);
  });

  it("only lists icons that exist", () => {
    for (const icon of icons) {
      expect(existsSync(join(process.cwd(), "public", icon.src)), icon.src).toBe(true);
    }
  });
});
