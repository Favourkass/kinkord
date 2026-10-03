import type { PushState } from "@/domain/push";

/** Copy for push notifications: the settings row and the prompt card. */
export const PUSH_COPY = {
  settingsHeading: "Notifications",
  settingsLabel: "Push notifications",
  describe: {
    on: "On for this device. You'll hear about messages, followers and activity on your posts.",
    off: "Hear about messages, followers and activity on your posts, even when Kinkord is closed.",
    blocked:
      "Blocked in your browser. Allow notifications for kinkord.com in its settings, then come back.",
    install:
      "On iPhone, add Kinkord to your Home Screen first (Share → Add to Home Screen), then open it from there.",
    unsupported: "This browser can't show notifications.",
  } satisfies Record<PushState, string>,
  /** Shown on Android once notifications are on: the one switch only the member can flip. */
  androidPopTip:
    "To make Kinkord pop up on your screen like other apps: long-press a Kinkord notification, tap the ⚙ settings icon, and turn on “Pop on screen” (on some phones it's called “Floating notifications”).",
  turnOn: "Turn on",
  turnOff: "Turn off",
  working: "…",
  failed: "Couldn't change notifications. Try again.",
  prompt: {
    enable: "Want to know when someone messages you? Turn on notifications.",
    install: "To get notifications on iPhone, add Kinkord to your Home Screen.",
    dismiss: "Not now",
  },
} as const;
