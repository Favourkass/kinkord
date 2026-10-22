import { expect, it } from "vitest";
import { genderSelectionChanges } from "./gender-policy";
import { GENDERS } from "./profile-options";

it("accepts every supplied gender outside Nigeria and preserves an existing primary", () => {
  for (const gender of GENDERS)
    expect(genderSelectionChanges("GH", [gender]).genders).toEqual([gender]);
  expect(genderSelectionChanges("US", ["Non-Binary", "Female"], "female")).toEqual({
    genders: ["Non-Binary", "Female"],
    gender: "female",
  });
});
it("restricts Nigeria to Male and Female, including legacy lower case values", () => {
  expect(genderSelectionChanges("NG", ["male", "female"]).genders).toEqual(["Male", "Female"]);
  for (const country of ["NG", "nigeria", null])
    expect(() => genderSelectionChanges(country, ["Non-Binary"])).toThrow("Only Male and Female");
});
it("rejects more than five, duplicates and unknown values", () => {
  for (const values of [GENDERS.slice(0, 6), ["Male", "male"], ["Unknown"]])
    expect(() => genderSelectionChanges("GH", values)).toThrow();
  expect(genderSelectionChanges("GH", GENDERS.slice(0, 5)).genders).toHaveLength(5);
});
