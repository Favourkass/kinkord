import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GENDERS,
  KINKS,
  KINK_ROLES,
  LANGUAGES,
  LOOKING_FOR,
  ORIENTATIONS,
  PROFILE_OPTIONS,
  RELATIONSHIP_STATUSES,
} from "./profile-options";

const unique = (xs: readonly string[]) => new Set(xs).size === xs.length;

describe("profile options (CEO brief, 2026-09-12)", () => {
  it("offers exactly the lists the CEO specified", () => {
    expect(GENDERS.slice(0, 2)).toEqual(["Male", "Female"]);
    expect(GENDERS).toHaveLength(95);
    expect(RELATIONSHIP_STATUSES).toHaveLength(17);
    expect(RELATIONSHIP_STATUSES[0]).toBe("Single");
    expect(RELATIONSHIP_STATUSES.at(-1)).toBe("Head of Household (HoH)");
    expect(KINK_ROLES).toHaveLength(868);
    expect(KINKS).toHaveLength(100);
    expect(KINKS[0]).toBe("Age play (adults only)");
    expect(KINKS.at(-1)).toBe("Urolagnia");
    expect(LOOKING_FOR).toHaveLength(10);
    expect(PROFILE_OPTIONS.nameChangeCooldownDays).toBe(30);
  });

  it("has no duplicates", () => {
    for (const list of [RELATIONSHIP_STATUSES, KINK_ROLES, KINKS, LOOKING_FOR, LANGUAGES]) {
      expect(unique(list)).toBe(true);
    }
    expect(PROFILE_OPTIONS.roles).toBe(KINK_ROLES);
  });
});

describe("sexuality options (founder, 2026-10-14)", () => {
  it("offers Straight and Bisexual, served with the other pickers", () => {
    expect(ORIENTATIONS).toEqual(["Straight", "Bisexual"]);
    expect(PROFILE_OPTIONS.orientations).toBe(ORIENTATIONS);
  });
});

it("matches all 100 supplied kinks and interests verbatim", () => {
  const supplied = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../../scripts/data/requested-kink-interests.json"),
      "utf8",
    ),
  );
  expect(KINKS).toEqual(supplied);
});
