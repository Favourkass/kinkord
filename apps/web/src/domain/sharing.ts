export interface ShareFriendPM {
  userId: string;
  username: string | null;
  displayName: string | null;
}
export type ShareMode = "choices" | "caption" | "friends";
export type ExternalShare = "whatsapp" | "twitter" | "native" | "copy";

/** What a shared link says in a chat or on WhatsApp: the caption, if any, then the link. */
export function shareText(caption: string, url: string): string {
  return [caption.trim(), url].filter(Boolean).join("\n\n");
}
