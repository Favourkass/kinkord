/** Settings → Notifications: which kinds of notification reach the member's devices. */
export const PUSH_GROUP_KEYS = [
  "messages",
  "comments",
  "tags",
  "friends",
  "likes",
  "follows",
] as const;
export type PushGroup = (typeof PUSH_GROUP_KEYS)[number];

export interface PushPreferencesPM {
  settings: Record<PushGroup, boolean>;
}

export function pushPreferencesFromTransport(value: unknown): PushPreferencesPM {
  const settings =
    value && typeof value === "object" && "settings" in value ? value.settings : null;
  if (!settings || typeof settings !== "object") throw new Error("Invalid notification settings.");
  const parsed = {} as Record<PushGroup, boolean>;
  for (const key of PUSH_GROUP_KEYS) {
    const on = (settings as Record<string, unknown>)[key];
    if (typeof on !== "boolean") throw new Error("Invalid notification setting.");
    parsed[key] = on;
  }
  return { settings: parsed };
}
