import type { EditorDraft, ProfileOptionsPM } from "@/domain/profile";
import { ROW_ICONS } from "@/constants/profileEdit";
import { profileApi } from "./profile.service";

export type SignupPreferenceKey = "interests" | "lookingFor" | "limits";
export interface SignupPreferences {
  interests: string[];
  lookingFor: string[];
  limits: string;
}
export const EMPTY_SIGNUP_PREFERENCES: SignupPreferences = {
  interests: [],
  lookingFor: [],
  limits: "",
};

export async function loadSignupPreferences() {
  const [profile, options] = await Promise.all([profileApi.own(), profileApi.options()]);
  return {
    options,
    preferences: {
      interests: profile.interests ?? [],
      lookingFor: profile.lookingFor ?? [],
      limits: profile.limits ?? "",
    },
  };
}

const titles = { interests: "Kinks & Interests", lookingFor: "Looking For", limits: "Limits" };
const icons = {
  interests: ROW_ICONS.kinks,
  lookingFor: ROW_ICONS.lookingFor,
  limits: ROW_ICONS.limits,
};

export function signupPreferenceRows(
  preferences: SignupPreferences,
  open: (key: SignupPreferenceKey) => void,
) {
  return (["interests", "lookingFor", "limits"] as const).map((key) => ({
    key,
    title: titles[key],
    icon: icons[key],
    subtitle:
      key === "limits"
        ? preferences.limits.trim() || "Not set"
        : preferences[key].join(", ") || "Not set",
    onClick: () => open(key),
  }));
}

export function signupPreferenceDraft(
  key: SignupPreferenceKey,
  preferences: SignupPreferences,
): EditorDraft {
  return key === "limits"
    ? { kind: "textarea", value: preferences.limits }
    : { kind: "multi", value: [...preferences[key]] };
}

function validatePreferences(preferences: SignupPreferences, options: ProfileOptionsPM) {
  if (
    preferences.interests.length > 20 ||
    preferences.interests.some((value) => !options.kinks.includes(value))
  )
    throw new Error("Choose up to 20 kinks and interests from the list.");
  if (
    preferences.lookingFor.length > 10 ||
    preferences.lookingFor.some((value) => !options.lookingFor.includes(value))
  )
    throw new Error("Choose up to 10 Looking For options from the list.");
  if (preferences.limits.trim().length > 500)
    throw new Error("Keep your limits within 500 characters.");
}

export function applySignupPreference(
  key: SignupPreferenceKey,
  draft: EditorDraft,
  preferences: SignupPreferences,
  options: ProfileOptionsPM,
): SignupPreferences {
  if (
    (key === "limits" && draft.kind !== "textarea") ||
    (key !== "limits" && draft.kind !== "multi")
  )
    throw new Error("Choose a valid preference.");
  const next =
    key === "limits" && draft.kind === "textarea"
      ? { ...preferences, limits: draft.value.trim() }
      : draft.kind === "multi"
        ? { ...preferences, [key]: [...new Set(draft.value)] }
        : preferences;
  validatePreferences(next, options);
  return next;
}

export function signupPreferenceEditor(key: SignupPreferenceKey, options: ProfileOptionsPM) {
  if (key === "limits")
    return {
      title: titles[key],
      help: "Your hard limits — the things you won't do.",
      editor: {
        kind: "textarea" as const,
        maxLength: 500,
        placeholder: "e.g. No blood, no permanent marks",
      },
    };
  const max = key === "interests" ? 20 : 10;
  return {
    title: titles[key],
    help: `Pick up to ${max}.`,
    editor: {
      kind: "multi" as const,
      max,
      searchable: true,
      options: (key === "interests" ? options.kinks : options.lookingFor).map((value) => ({
        value,
        label: value,
      })),
    },
  };
}

export async function saveSignupPreferences(
  preferences: SignupPreferences,
  options: ProfileOptionsPM,
) {
  validatePreferences(preferences, options);
  return profileApi.update({
    interests: preferences.interests,
    lookingFor: preferences.lookingFor,
    limits: preferences.limits.trim() || null,
  });
}

export function filterSignupRoles(options: readonly string[], query: string): string[] {
  const search = query.trim().toLowerCase();
  return options.filter((role) => role.toLowerCase().includes(search));
}
