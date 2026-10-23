import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileOptionsPM } from "@/domain/profile";
import {
  applySignupPreference,
  loadSignupPreferences,
  saveSignupPreferences,
  EMPTY_SIGNUP_PREFERENCES,
  filterSignupRoles,
  toggleSignupSelection,
  signupPreferenceEditor,
} from "./signupPreferences.service";
const mocks = vi.hoisted(() => ({ own: vi.fn(), options: vi.fn(), update: vi.fn() }));
vi.mock("./profile.service", () => ({ profileApi: mocks }));
const options = {
  orientationSelections: ["Asexual", "Demisexual", "Queer", "Unsure", "Pansexual", "Bisexual"],
  orientations: ["Straight", "Bisexual"],
  kinks: ["Bondage", "Roleplay"],
  lookingFor: ["Friendship", "Partner"],
} as unknown as ProfileOptionsPM;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.options.mockResolvedValue(options);
  mocks.own.mockResolvedValue({ interests: ["Bondage"], lookingFor: [], limits: "No blood" });
  mocks.update.mockResolvedValue({});
});
describe("signup preferences", () => {
  it("allows 20 interests but rejects a 21st and duplicate saved selections", async () => {
    const choices = Array.from({ length: 21 }, (_, i) => `Interest ${i}`);
    const available = { ...options, kinks: choices };
    expect(signupPreferenceEditor("interests", available).editor).toMatchObject({
      kind: "multi",
      max: 20,
      searchable: true,
    });
    await saveSignupPreferences(
      { ...EMPTY_SIGNUP_PREFERENCES, interests: choices.slice(0, 20) },
      available,
    );
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ interests: choices.slice(0, 20) }),
    );
    for (const interests of [choices, [choices[0], choices[0]]]) {
      await expect(
        saveSignupPreferences({ ...EMPTY_SIGNUP_PREFERENCES, interests }, available),
      ).rejects.toThrow("Choose up to 20");
    }
  });
  it("keeps previously saved interest labels available when resuming signup", async () => {
    mocks.own.mockResolvedValue({ interests: ["Latex"], lookingFor: [], limits: "" });
    const loaded = await loadSignupPreferences();
    expect(loaded.options.kinks).toContain("Latex");
    await saveSignupPreferences(loaded.preferences, loaded.options);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ interests: ["Latex"] }));
  });
  it("saves orientation selections separately and enforces five unique choices", async () => {
    const selections = options.orientationSelections!;
    await saveSignupPreferences(
      {
        ...EMPTY_SIGNUP_PREFERENCES,
        country: "GH",
        orientation: "Straight",
        orientationSelections: selections.slice(0, 5),
      },
      options,
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        orientation: null,
        orientationSelections: selections.slice(0, 5),
      }),
    );
    for (const values of [[...selections], ["Unknown"], ["Queer", "Queer"]]) {
      await expect(
        saveSignupPreferences(
          { ...EMPTY_SIGNUP_PREFERENCES, country: "GH", orientationSelections: values },
          options,
        ),
      ).rejects.toThrow("Choose up to 5 orientations");
    }
  });
  it("blocks adding a sixth selection but permits removing existing values", () => {
    const choices = ["a", "b", "c", "d", "e", "f"];
    expect(toggleSignupSelection(choices.slice(0, 5), "f", choices)).toEqual(choices.slice(0, 5));
    expect(toggleSignupSelection(choices, "a", choices)).toEqual(choices.slice(1));
    expect(toggleSignupSelection([], "unknown", choices)).toEqual([]);
  });
  it.each(["GH", "KE", "US"])(
    "saves and clears sexuality with preferences for %s",
    async (country) => {
      await saveSignupPreferences(
        { ...EMPTY_SIGNUP_PREFERENCES, country, orientation: "Bisexual" },
        options,
      );
      expect(mocks.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ orientation: null, orientationSelections: ["Bisexual"] }),
      );
      await saveSignupPreferences(
        { ...EMPTY_SIGNUP_PREFERENCES, country, orientation: "" },
        options,
      );
      expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ orientation: null }));
    },
  );
  it("never submits sexuality for Nigeria, even with a stale selection", async () => {
    await saveSignupPreferences(
      { ...EMPTY_SIGNUP_PREFERENCES, country: "NG", orientation: "Bisexual" },
      options,
    );
    expect(mocks.update).toHaveBeenCalledWith({ interests: [], lookingFor: [], limits: null });
  });
  it("rejects an unlisted sexuality before saving", async () => {
    await expect(
      saveSignupPreferences(
        { ...EMPTY_SIGNUP_PREFERENCES, country: "GH", orientation: "Unknown" },
        options,
      ),
    ).rejects.toThrow("Choose up to 5 orientations");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("loads existing values and API-owned options", async () => {
    expect(await loadSignupPreferences()).toEqual({
      options,
      preferences: {
        country: "NG",
        orientation: null,
        orientationSelections: [],
        interests: ["Bondage"],
        lookingFor: [],
        limits: "No blood",
      },
    });
  });
  it("applies choices without mutating the original draft", () => {
    const next = applySignupPreference(
      "interests",
      { kind: "multi", value: ["Bondage", "Bondage"] },
      EMPTY_SIGNUP_PREFERENCES,
      options,
    );
    expect(next.interests).toEqual(["Bondage"]);
    expect(EMPTY_SIGNUP_PREFERENCES.interests).toEqual([]);
  });
  it("rejects values outside the supplied options and long limits", () => {
    expect(() =>
      applySignupPreference(
        "lookingFor",
        { kind: "multi", value: ["Unknown"] },
        EMPTY_SIGNUP_PREFERENCES,
        options,
      ),
    ).toThrow(/from the list/);
    expect(() =>
      applySignupPreference(
        "limits",
        { kind: "textarea", value: "x".repeat(501) },
        EMPTY_SIGNUP_PREFERENCES,
        options,
      ),
    ).toThrow(/500/);
  });
  it("saves all three fields and permits empty preferences", async () => {
    await saveSignupPreferences(EMPTY_SIGNUP_PREFERENCES, options);
    expect(mocks.update).toHaveBeenCalledWith({ interests: [], lookingFor: [], limits: null });
    await saveSignupPreferences(
      { interests: ["Bondage"], lookingFor: ["Friendship"], limits: " No blood " },
      options,
    );
    expect(mocks.update).toHaveBeenLastCalledWith({
      interests: ["Bondage"],
      lookingFor: ["Friendship"],
      limits: "No blood",
    });
  });
  it("propagates failures without pretending the values saved", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Could not save"));
    await expect(saveSignupPreferences(EMPTY_SIGNUP_PREFERENCES, options)).rejects.toThrow(
      "Could not save",
    );
  });
});

it("filters roles case-insensitively and handles no matches", () => {
  expect(
    filterSignupRoles(["Acolyte", "Aftercare Buddy", "Aftercare Specialist"], " AFTERCARE "),
  ).toEqual(["Aftercare Buddy", "Aftercare Specialist"]);
  expect(filterSignupRoles(["Acolyte"], "zzzz")).toEqual([]);
});
