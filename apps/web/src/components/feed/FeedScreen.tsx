import InfiniteSentinel from "@/components/members/InfiniteSentinel";
import Link from "next/link";
import type { FeedEmptyVM, PostMediaVM, PostVM } from "@/domain/post";
import CommentsPanel, { type CommentsPanelProps } from "./CommentsPanel";
import ComposerBar, { type ComposerBarProps } from "./ComposerBar";
import ComposerDialog, { type ComposerDialogProps } from "./ComposerDialog";
import ConfirmDialog, { type ConfirmDialogProps } from "./ConfirmDialog";
import FeedShell, { type FeedShellProps } from "./FeedShell";
import FeedTabs, { feedTabId, type FeedTabsProps } from "./FeedTabs";
import MediaLightbox, { type MediaLightboxProps } from "./MediaLightbox";
import KinkstersNearYou, { type KinkstersNearYouProps } from "./KinkstersNearYou";
import PostCard, { type PostCardProps } from "./PostCard";
import GiftDialog, { type GiftDialogProps } from "./GiftDialog";
import Toast, { type ToastProps } from "./Toast";

/** The list of posts the tabs control. */
const PANEL_ID = "feed-panel";

export interface FeedScreenProps {
  shell: Omit<FeedShellProps, "aside" | "children">;
  /** For You | Following | Nearby at the top of the feed. */
  tabs: Omit<FeedTabsProps, "panelId">;
  loading: boolean;
  error: string | null;
  posts: PostVM[];
  postLabels: PostCardProps["labels"];
  menuFor: string | null;
  onOpenMenu: (id: string) => void;
  onCloseMenu: () => void;
  onAskDelete: (id: string) => void;
  onToggleBody: (id: string) => void;
  /** Reactions target `post.postId`: acting on a repost acts on the post it points at. */
  onLike: (postId: string) => void;
  onRepost: (postId: string) => void;
  onComment: (postId: string) => void;
  onSave: (postId: string) => void;
  onShare: (postId: string) => void;
  onGift: (postId: string, currency?: "coin" | "star" | "crown") => void;
  onOpenMedia: (media: PostMediaVM) => void;
  onTogglePostAuthorFollow: (userId: string) => void;
  /** The viewer takes their tag off a post. */
  onRemoveTag?: (postId: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  composerBar: ComposerBarProps;
  composerDialog: ComposerDialogProps;
  commentsPanel: CommentsPanelProps;
  /** "Kinksters Near You"; null on a tab that doesn't carry it. */
  people: KinkstersNearYouProps | null;
  /** What the feed says when the tab has no posts. */
  empty: FeedEmptyVM;
  lightbox: MediaLightboxProps;
  confirm: ConfirmDialogProps;
  toast: ToastProps;
  giftDialog: GiftDialogProps;
  copy: {
    loading: string;
    loadMore: string;
    asideHeading: string;
    asideTagline: string;
  };
}

/**
 * The home feed (Figma "Hompage Light" 344:138 / dark 837:295), under its
 * For You | Following | Nearby tabs.
 *
 * On a phone the suggestions strip sits between the first and second post, as
 * drawn. On desktop it moves to the right rail and the same cards stack there,
 * so nothing in the design is lost and nothing is invented for the wide layout.
 * A tab without the strip (Following) shows it in neither place.
 */
export default function FeedScreen(p: FeedScreenProps) {
  const selected = p.tabs.tabs.find((t) => t.selected);
  const card = (post: PostVM) => (
    <PostCard
      key={post.id}
      post={post}
      labels={p.postLabels}
      menuOpen={p.menuFor === post.id}
      onMenu={() => p.onOpenMenu(post.id)}
      onCloseMenu={p.onCloseMenu}
      onDelete={() => p.onAskDelete(post.id)}
      onToggleBody={() => p.onToggleBody(post.id)}
      onLike={() => p.onLike(post.postId)}
      onRepost={() => p.onRepost(post.postId)}
      onComment={() => p.onComment(post.postId)}
      onSave={() => p.onSave(post.postId)}
      onShare={() => p.onShare(post.postId)}
      onGift={(currency) => p.onGift(post.postId, currency)}
      onOpenMedia={p.onOpenMedia}
      onToggleAuthorFollow={p.onTogglePostAuthorFollow}
      onRemoveTag={p.onRemoveTag ? () => p.onRemoveTag?.(post.postId) : undefined}
    />
  );

  return (
    <>
      <FeedShell
        {...p.shell}
        aside={
          <>
            {p.people && <KinkstersNearYou {...p.people} layout="column" />}
            <section className="rounded-[16px] border border-feed-line bg-feed-card p-[16px]">
              <p className="text-[14px] font-bold tracking-[1.4px] text-kink-gold-bright">
                {p.copy.asideHeading}
              </p>
              <p className="pt-[4px] text-[12px] text-feed-muted">{p.copy.asideTagline}</p>
            </section>
          </>
        }
      >
        <FeedTabs {...p.tabs} panelId={PANEL_ID} />
        <ComposerBar {...p.composerBar} />

        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={selected ? feedTabId(selected.value) : undefined}
        >
          {p.error && (
            <p className="px-[25px] py-[40px] text-center text-[15px] font-semibold text-feed-muted">
              {p.error}
            </p>
          )}

          {p.loading && !p.error && (
            <p className="px-[25px] py-[40px] text-center text-[14px] text-feed-muted">
              {p.copy.loading}
            </p>
          )}

          {!p.loading && !p.error && p.posts.length === 0 && (
            <div className="px-[25px] py-[48px] text-center">
              <p className="text-[16px] font-bold text-feed-text">{p.empty.title}</p>
              {p.empty.body && (
                <p className="pt-[6px] text-[14px] text-feed-muted">{p.empty.body}</p>
              )}
              {p.empty.action && (
                <Link
                  href={p.empty.action.href}
                  className="mt-[16px] inline-flex h-[36px] items-center rounded-full bg-kink-gold-bright px-[18px] text-[14px] font-semibold text-kink-ink"
                >
                  {p.empty.action.label}
                </Link>
              )}
            </div>
          )}

          {p.posts.slice(0, 1).map(card)}
          {/* The design puts the suggestions between the first and second post. */}
          {p.people && (
            <div className="lg:hidden">
              <KinkstersNearYou {...p.people} />
            </div>
          )}
          {p.posts.slice(1).map(card)}

          <InfiniteSentinel
            onVisible={p.onLoadMore}
            enabled={p.hasMore && !p.loading && !p.loadingMore && !p.error}
            loading={p.loadingMore}
            loadingText={p.copy.loading}
            endText={null}
          />
        </div>
      </FeedShell>

      <ComposerDialog {...p.composerDialog} />
      <CommentsPanel {...p.commentsPanel} />
      <MediaLightbox {...p.lightbox} />
      <ConfirmDialog {...p.confirm} />
      <Toast {...p.toast} />
      <GiftDialog {...p.giftDialog} />
    </>
  );
}
