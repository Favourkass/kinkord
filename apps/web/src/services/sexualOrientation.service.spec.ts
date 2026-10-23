import { expect, it } from "vitest";
import { sexualOrientationSelections } from "./sexualOrientation.service";

it("retains legacy choices until replaced and keeps cleared choices empty", () => {
  expect(
    sexualOrientationSelections({ orientation: "Bisexual", orientationSelections: [] }),
  ).toEqual(["Bisexual"]);
  expect(
    sexualOrientationSelections({ orientation: "Straight", orientationSelections: ["Queer"] }),
  ).toEqual(["Queer"]);
  expect(sexualOrientationSelections({ orientation: null, orientationSelections: [] })).toEqual([]);
});
