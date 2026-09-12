import { describe, expectTypeOf, it } from "vitest";
import type { EditorDraft, EditorSpec, EditRowKey, EditSectionKey, OwnProfilePM } from "./profile";

/** The Edit Profile contracts are types only; pin the shapes the presenters and API rely on. */
describe("profile domain contracts", () => {
  it("names the five Edit Profile sections' rows and the editor kinds", () => {
    expectTypeOf<EditSectionKey>().toEqualTypeOf<"basic" | "kinks" | "location" | "privacy">();
    expectTypeOf<EditRowKey>().toMatchTypeOf<string>();
    expectTypeOf<EditorSpec["kind"]>().toEqualTypeOf<
      "text" | "textarea" | "single" | "multi" | "date" | "links"
    >();
    expectTypeOf<EditorDraft["kind"]>().toEqualTypeOf<
      "text" | "textarea" | "date" | "single" | "multi" | "links"
    >();
  });

  it("carries the 30-day lock dates the API computes", () => {
    expectTypeOf<OwnProfilePM["canChangeDisplayNameAt"]>().toEqualTypeOf<string | null>();
    expectTypeOf<OwnProfilePM["canChangeUsernameAt"]>().toEqualTypeOf<string | null>();
    expectTypeOf<OwnProfilePM["profileVisibility"]>().toEqualTypeOf<"public" | "friends">();
  });
});
