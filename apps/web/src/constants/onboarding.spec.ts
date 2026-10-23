import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { GENDERS, KINK_ROLES, ORIENTATION_SELECTIONS } from "./onboarding";

it("includes all 95 supplied genders with Male and Female first, matching the API", () => {
  const requested = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../../scripts/data/requested-gender-options.json"),
      "utf8",
    ),
  );
  expect(GENDERS).toEqual(requested);
  expect(GENDERS).toHaveLength(95);
  expect(GENDERS.slice(0, 2)).toEqual(["Male", "Female"]);
  const source = readFileSync(
    resolve(process.cwd(), "../api/src/profiles/profile-options.ts"),
    "utf8",
  );
  const array = source.match(/export const GENDERS = (\[[\s\S]*?\]) as const;/)?.[1];
  expect(JSON.parse(array!.replace(/,\s*\]/, "]"))).toEqual(GENDERS);
});

it("includes exactly the 99 supplied orientations and matches the backend", () => {
  const requested = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../../scripts/data/requested-orientation-options.json"),
      "utf8",
    ),
  ) as string[];
  expect(ORIENTATION_SELECTIONS).toHaveLength(99);
  expect([...ORIENTATION_SELECTIONS].sort()).toEqual(requested.sort());
  const source = readFileSync(
    resolve(process.cwd(), "../api/src/profiles/profile-options.ts"),
    "utf8",
  );
  const array = source.match(/export const ORIENTATION_SELECTIONS = (\[[\s\S]*?\]) as const;/)?.[1];
  expect(JSON.parse(array!.replace(/,\s*\]/, "]"))).toEqual(ORIENTATION_SELECTIONS);
});

it("includes every supplied role without case duplicates and preserves existing saved labels", () => {
  const requested = JSON.parse(
    readFileSync(resolve(process.cwd(), "../../scripts/data/requested-kink-roles.json"), "utf8"),
  ) as string[];
  const normalized = KINK_ROLES.map((role) => role.toLowerCase());
  expect(requested).toHaveLength(864);
  expect(new Set(normalized).size).toBe(KINK_ROLES.length);
  for (const role of requested) expect(normalized).toContain(role.toLowerCase());
  expect(KINK_ROLES).toEqual(
    expect.arrayContaining([
      "Acolyte",
      "Adult Baby",
      "Bottom",
      "Pet",
      "Submissive",
      "Curious",
      "Aftercare Buddy",
      "Aftercare Specialist",
    ]),
  );
});

it("offers exactly the same roles during signup and through the profile API", () => {
  const source = readFileSync(
    resolve(process.cwd(), "../api/src/profiles/profile-options.ts"),
    "utf8",
  );
  const array = source.match(/export const KINK_ROLES = (\[[\s\S]*?\]) as const;/)?.[1];
  expect(array).toBeDefined();
  expect(JSON.parse(array!.replace(/,\s*\]/, "]"))).toEqual(KINK_ROLES);
});
