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
} as const;

/** Why the photo button does nothing yet, naming who has to write first. */
export function photosLockedText(name: string): string {
  return `You can send photos once ${name} has written to you.`;
}
