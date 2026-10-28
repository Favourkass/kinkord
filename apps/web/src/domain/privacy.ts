export const PRIVACY_FIELD_KEYS = [
  "directory",
  "profilePhoto",
  "coverPhoto",
  "bio",
  "location",
  "interests",
  "relationshipStatus",
  "followersFollowing",
  "posts",
  "media",
  "onlineStatus",
  "tagging",
  "stories",
  "pinnedPosts",
  "sharedContent",
  "search",
  "readReceipts",
  "messaging",
] as const;
export const PRIVACY_AUDIENCE_VALUES = [
  "friends",
  "followers",
  "following",
  "members",
  "country",
  "continent",
  "verified",
  "onlyMe",
] as const;
export type PrivacyField = (typeof PRIVACY_FIELD_KEYS)[number];
export type PrivacyAudience = (typeof PRIVACY_AUDIENCE_VALUES)[number];
export interface PrivacyPM {
  settings: Record<PrivacyField, PrivacyAudience>;
}
export function privacyFromTransport(value: unknown): PrivacyPM {
  const settings =
    value && typeof value === "object" && "settings" in value ? value.settings : null;
  if (!settings || typeof settings !== "object") throw new Error("Invalid privacy response.");
  const parsed = {} as Record<PrivacyField, PrivacyAudience>;
  for (const field of PRIVACY_FIELD_KEYS) {
    const raw = (settings as Record<string, unknown>)[field];
    const choice = field === "messaging" && raw === undefined ? "members" : raw;
    const audience = PRIVACY_AUDIENCE_VALUES.find((item) => item === choice);
    if (!audience) throw new Error("Invalid privacy audience.");
    parsed[field] = audience;
  }
  return { settings: parsed };
}
