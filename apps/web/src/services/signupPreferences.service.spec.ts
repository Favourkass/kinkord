import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileOptionsPM } from "@/domain/profile";
import {
  applySignupPreference,
  loadSignupPreferences,
  saveSignupPreferences,
  EMPTY_SIGNUP_PREFERENCES,
} from "./signupPreferences.service";
const mocks = vi.hoisted(() => ({ own: vi.fn(), options: vi.fn(), update: vi.fn() }));
vi.mock("./profile.service", () => ({ profileApi: mocks }));
const options = {
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
  it("loads existing values and API-owned options", async () => {
    expect(await loadSignupPreferences()).toEqual({
      options,
      preferences: { interests: ["Bondage"], lookingFor: [], limits: "No blood" },
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
