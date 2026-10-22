import { expect, it } from "vitest";
import { genderOptions, genderSelectionIssue, selectedGenders } from "./genderSelection.service";

it("puts Male and Female first, then the rest alphabetically", () => {
  const options = genderOptions("GH");
  expect(options).toHaveLength(95);
  expect(options.slice(0, 2)).toEqual(["Male", "Female"]);
  expect(options.slice(2)).toEqual([...options.slice(2)].sort((a, b) => a.localeCompare(b)));
});
it("limits Nigerian choices and validates five distinct selections", () => {
  expect(genderOptions("NG")).toEqual(["Male", "Female"]);
  expect(genderSelectionIssue("NG", ["Male", "Female"])).toBeNull();
  expect(genderSelectionIssue("NG", ["Agender"])).not.toBeNull();
  expect(genderSelectionIssue("US", genderOptions("US").slice(0, 5))).toBeNull();
  for (const values of [[], ["Male", "Male"], genderOptions("US").slice(0, 6)])
    expect(genderSelectionIssue("US", values)).not.toBeNull();
});
it("loads existing single genders and preserves an explicitly cleared draft", () => {
  expect(selectedGenders(undefined, "female")).toEqual(["Female"]);
  expect(selectedGenders(["Non-Binary", "Female"], "female")).toEqual(["Non-Binary", "Female"]);
  expect(selectedGenders([], "female")).toEqual([]);
});
