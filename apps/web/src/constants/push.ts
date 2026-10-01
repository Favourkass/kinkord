import type { PushState } from "@/domain/push";

/** Copy for push notifications: the settings row and the prompt card. */
export const PUSH_COPY = {
  settingsHeading: "Notifications",
  settingsLabel: "Push notifications",
  describe: {
    on: "On for this device. You'll hear about new messages, followers and comments.",
    off: "Get told about new messages, followers and comments, even when Kinkord is closed.",
    blocked:
      "Blocked in your browser. Allow notifications for kinkord.com in its settings, then come back.",
    install:
      "On iPhone, add Kinkord to your Home Screen first (Share → Add to Home Screen), then open it from there.",
    unsupported: "This browser can't show notifications.",
  } satisfies Record<PushState, string>,
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
