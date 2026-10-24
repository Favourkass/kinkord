import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { BRAND_NAME } from "./landing";

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.includes(".spec.") ? [path] : [];
  });

it("names the app Kinkord, with a capital K, on every app screen", () => {
  expect(BRAND_NAME).toBe("Kinkord");
  // Screens hand the shell the shared name instead of spelling out their own.
  const spelledOut = sources(resolve(process.cwd(), "src/app")).filter((path) =>
    /brand(=|: )"/.test(readFileSync(path, "utf8")),
  );
  expect(spelledOut).toEqual([]);
});
