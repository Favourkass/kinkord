/** The longest inbox search the API takes. */
export const INBOX_SEARCH_MAX = 100;

/** Copy for the chat screens. */
export const CHAT_COPY = {
  messagingPrivacy:
    "Your privacy settings or this member's privacy settings do not allow messaging between you. Existing messages are still available to read.",
  heading: "Messages",
  inbox: {
    search: "Search chats…",
    searchLabel: "Search chats",
    clear: "Clear search",
    filtersLabel: "Show or hide chat filters",
    menu: "More options",
    navigation: "Open menu",
    newChat: "New message",
    settings: "Settings",
    sent: "Sent",
    unread: "unread messages",
    filters: { all: "All", unread: "Unread", online: "Online" },
    filteredEmpty: "No chats found",
    filteredBody: "Try another search or choose a different filter.",
  },
  loading: "Loading conversations…",
  emptyTitle: "No messages yet",
  emptyBody: "Open someone's profile and tap Message to start a conversation.",
  online: "Online",
  /** Beside the official organization's name, so nobody can pass for it in a chat. */
  organization: "Official",
  verifiedOrganization: "Official Kinkord account",
  presence: { online: "Online", away: "Away", offline: "Offline" },
  typing: "Is typing…",
  back: "Back",
  threadEmpty: "Say hi — this is the start of your conversation.",
  unavailable: "This member is no longer on Kinkord.",
  retry: "Tap to retry",
  loadMore: "Load earlier messages",
  placeholder: "Message…",
  send: "Send",
  emoji: {
    label: "Choose an emoji",
    options: [
      "😀",
      "😊",
      "😂",
      "😍",
      "🥰",
      "😘",
      "😉",
      "😎",
      "❤️",
      "💛",
      "🔥",
      "✨",
      "🙌",
      "👏",
      "👍",
      "🤗",
    ],
  },
  opening: "Opening conversation…",
  loadError: "Couldn't load this. Check your connection and try again.",
  newChatHint: (perDay: number) =>
    `You can start ${perDay} new ${perDay === 1 ? "chat" : "chats"} a day. Sending a message here uses one of today's.`,
  /** At the free allowance: the way to more is Silver. */
  newChatLimit: (perDay: number | null) =>
    `🔒 Messaging Is a Premium Feature\n\nUpgrade to Kinkord Premium to unlock messaging and start connecting with kinksters worldwide.\n\nEnjoy more ways to connect, chat, and build meaningful relationships.\n\n${
      perDay === 0
        ? "You can always reply when someone messages you first."
        : `You've used today's ${perDay === null ? "" : `${perDay} `}new ${perDay === 1 ? "chat" : "chats"}. You can start another after midnight. Replies in your existing chats aren't limited.`
    }`,
  /** At Silver's allowance: nothing bigger to offer, just the reset. */
  newChatLimitSilver: (perDay: number | null) =>
    `You've used today's ${perDay === null ? "" : `${perDay} `}new chats. You can message someone new after midnight. Replies in your existing chats aren't limited.`,
  /** A free member writing first to someone in another country. */
  crossCountry:
    "🔒 Messaging Is a Premium Feature\n\nUpgrade to Kinkord Premium to unlock messaging and start connecting with kinksters worldwide.\n\nEnjoy more ways to connect, chat, and build meaningful relationships.\n\nStarting a chat with someone in another country requires Premium. You can always reply if they message you first.",
  getSilver: "Upgrade to Premium",
  photoAdd: "Add a photo",
  photoRemove: "Remove photo",
  photoUploading: "Uploading…",
  photoUploadFailed: "Couldn't upload that photo. Try again.",
  photoAlt: "Photo",
  photoReveal: "Tap to view",
  photoOpen: "Open photo",
  photoClose: "Close",
  menu: "More options",
  menuReport: "Report",
  menuBlock: "Block",
  menuUnblock: "Unblock",
  blockConfirm: "Block",
  cancel: "Cancel",
  unblock: "Unblock",
  safetyFailed: "Couldn't do that. Check your connection and try again.",
  report: {
    intro:
      "Our team reviews every report, and will see the last messages in this chat. They won't tell the member who reported them.",
    reasons: {
      underage: "They may be under 18",
      illegal: "Something illegal",
      non_consensual: "Sharing intimate images without consent",
      unwanted_sexual: "Unwanted sexual messages or photos",
      harassment: "Harassment or threats",
      spam: "Spam or a scam",
      other: "Something else",
    },
    detailsLabel: "Anything else we should know? (optional)",
    submit: "Send report",
    sending: "Sending…",
    done: "Thanks for telling us. Our team will review this.",
    close: "Close",
  },
} as const;

export function reportTitle(name: string): string {
  return `Report ${name}`;
}

export function alsoBlockText(name: string): string {
  return `Also block ${name}`;
}

export function blockConfirmText(name: string): string {
  return `Block ${name}? They won't be able to message you, and you won't hear from them here. You can unblock them any time.`;
}

/** In place of the composer, in a thread with someone the viewer blocked. */
export function blockedNoticeText(name: string): string {
  return `You blocked ${name}. Unblock them to send messages.`;
}

/** Why the photo button does nothing yet, naming who has to write first. */
export function photosLockedText(name: string): string {
  return `You can send photos once ${name} has written to you.`;
}
