import type { PushGroup } from "@/domain/pushPreferences";

export const NOTIFICATION_SETTINGS_COPY = {
  title: "Notifications",
  back: "← Settings",
  description:
    "Choose what reaches your phone. Everything still appears in your Notifications list.",
  rhythm:
    "Likes, shares and new followers come bundled, at most one push every two hours. Between 11pm and 7am only messages are sent; the rest waits until the morning.",
  loading: "Loading notification settings…",
  saved: "Saved.",
  loadError: "Could not load your notification settings. Please try again.",
  saveError: "Could not save that change. Your previous setting is still on. Try again.",
  retry: "Retry",
  groups: [
    { key: "messages", label: "Messages", hint: "New messages in your chats." },
    { key: "comments", label: "Comments and mentions", hint: null },
    { key: "tags", label: "Tags", hint: "When someone tags you in a post." },
    { key: "friends", label: "Friend and relationship requests", hint: null },
    { key: "likes", label: "Likes and shares", hint: "Bundled, at most every two hours." },
    { key: "follows", label: "New followers", hint: "Bundled, at most every two hours." },
  ] satisfies ReadonlyArray<{ key: PushGroup; label: string; hint: string | null }>,
} as const;
