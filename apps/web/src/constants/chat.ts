/** Copy for the chat screens. */
export const CHAT_COPY = {
  heading: "Messages",
  loading: "Loading conversations…",
  emptyTitle: "No messages yet",
  emptyBody: "Open someone's profile and tap Message to start a conversation.",
  online: "Online",
  back: "Back",
  threadEmpty: "Say hi — this is the start of your conversation.",
  unavailable: "This member is no longer on Kinkord.",
  retry: "Tap to retry",
  loadMore: "Load earlier messages",
  placeholder: "Message…",
  send: "Send",
  opening: "Opening conversation…",
  loadError: "Couldn't load this. Check your connection and try again.",
  newChatHint: "You can start one new chat a day. Sending a message here uses today's.",
  newChatLimit:
    "You've already started a new chat today. You can message someone new after midnight. Replies in your existing chats aren't limited.",
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
