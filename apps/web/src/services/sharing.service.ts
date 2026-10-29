import { shareText, type ExternalShare, type ShareFriendPM } from "@/domain/sharing";
import type { PostPM } from "@/domain/post";
import { api } from "./apiClient";
import { chatService } from "./chat.service";
import { postPermalink, postsApi } from "./posts.service";
export function externalShareUrl(target: "whatsapp" | "twitter", url: string, caption: string) {
  return target === "whatsapp"
    ? `https://wa.me/?text=${encodeURIComponent(shareText(caption, url))}`
    : `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(caption.trim())}`;
}
export const sharingService = {
  /** Friends the viewer can send a post to: accepted friends whose messaging setting allows it. */
  friends: (query: string) =>
    api.get<ShareFriendPM[]>(`/posts/share-friends?q=${encodeURIComponent(query.trim())}`),
  feed: (postId: string, caption: string) =>
    api.post<{ postId: string; shares: number; item: PostPM | null }>(
      `/posts/${encodeURIComponent(postId)}/share-feed`,
      { caption },
    ),
  friend: async (userId: string, postId: string, caption: string, clientId: string) => {
    // Existing messaging rules and daily allowances remain authoritative on the API.
    const conversation = await chatService.start(userId);
    await chatService.send(
      conversation.conversationId,
      shareText(caption, postPermalink(postId)),
      clientId,
    );
    // A failed counter update must not make a successfully sent message look unsent.
    return postsApi.share(postId).catch(() => null);
  },
  external: async (target: ExternalShare, postId: string, caption: string) => {
    const url = postPermalink(postId);
    if (target === "copy") await navigator.clipboard.writeText(url);
    else if (target === "native") {
      if (!navigator.share) throw new Error("Use WhatsApp, X or Copy link on this browser.");
      await navigator.share({ url, text: caption.trim() || undefined });
    } else {
      const opened = window.open(externalShareUrl(target, url, caption), "_blank");
      if (!opened) throw new Error("Allow pop-ups to open the share window.");
      opened.opener = null;
      return null; // Opening another app does not prove the member completed a share.
    }
    return postsApi.share(postId).catch(() => null);
  },
};
