import GiftDialog, { type GiftDialogProps } from "./GiftDialog";
import CommentsPanel, { type CommentsPanelProps } from "./CommentsPanel";
import ConfirmDialog, { type ConfirmDialogProps } from "./ConfirmDialog";
import FeedShell, { type FeedShellProps } from "./FeedShell";
import MediaLightbox, { type MediaLightboxProps } from "./MediaLightbox";
import PostList, { type PostListProps } from "./PostList";
import Toast, { type ToastProps } from "./Toast";

export interface PostListScreenProps extends PostListProps {
  shell: Omit<FeedShellProps, "aside" | "children">;
  heading: string;
  giftDialog: GiftDialogProps;
  commentsPanel: CommentsPanelProps;
  lightbox: MediaLightboxProps;
  confirm: ConfirmDialogProps;
  toast: ToastProps;
}

/**
 * A plain list of posts in the app chrome: one post on its own (a shared link)
 * and the saved list. Same shell and same card as the feed, without the
 * composer or the suggestions strip, neither of which belongs on either screen.
 */
export default function PostListScreen(p: PostListScreenProps) {
  return (
    <>
      <FeedShell {...p.shell} aside={null}>
        <h1 className="border-b border-feed-line px-[25px] py-[18px] text-[18px] font-bold text-feed-text">
          {p.heading}
        </h1>

        <PostList {...p} />
      </FeedShell>

      <CommentsPanel {...p.commentsPanel} />
      <MediaLightbox {...p.lightbox} />
      <ConfirmDialog {...p.confirm} />
      <Toast {...p.toast} />
      <GiftDialog {...p.giftDialog} />
    </>
  );
}
