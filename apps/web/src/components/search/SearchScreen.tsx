import GiftDialog, { type GiftDialogProps } from "@/components/feed/GiftDialog";
import CommentsPanel, { type CommentsPanelProps } from "@/components/feed/CommentsPanel";
import ConfirmDialog, { type ConfirmDialogProps } from "@/components/feed/ConfirmDialog";
import FeedShell, { type FeedShellProps } from "@/components/feed/FeedShell";
import MediaLightbox, { type MediaLightboxProps } from "@/components/feed/MediaLightbox";
import PostList, { type PostListProps } from "@/components/feed/PostList";
import Toast, { type ToastProps } from "@/components/feed/Toast";
import MaskIcon from "@/components/app/MaskIcon";
import SearchPeople, { type SearchPeopleProps } from "./SearchPeople";

export interface SearchScreenProps {
  shell: Omit<FeedShellProps, "aside" | "children">;
  query: string;
  onQuery: (value: string) => void;
  onClear: () => void;
  maxLength: number;
  tabs: Array<{ key: string; label: string; active: boolean }>;
  onTab: (key: string) => void;
  /** What to search for, before anything is typed. */
  hint: string | null;
  people: Omit<SearchPeopleProps, "labels"> & { shown: boolean };
  postsShown: boolean;
  postsHeading: string | null;
  posts: PostListProps;
  giftDialog: GiftDialogProps;
  commentsPanel: CommentsPanelProps;
  lightbox: MediaLightboxProps;
  confirm: ConfirmDialogProps;
  toast: ToastProps;
  labels: SearchPeopleProps["labels"] & { placeholder: string; label: string; clear: string };
}

/**
 * Search, Facebook's way: the box and its tabs stay at the top while the
 * people and posts it found scroll under them. Same chrome as the feed.
 */
export default function SearchScreen(p: SearchScreenProps) {
  const l = p.labels;
  return (
    <>
      <FeedShell {...p.shell} active="search" aside={null}>
        <div className="sticky top-0 z-10 border-b border-feed-line bg-app-surface px-[18px] pb-[12px] pt-[14px]">
          <label className="relative block">
            <span className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-feed-muted">
              <MaskIcon name="search" width={18} />
            </span>
            <input
              type="search"
              value={p.query}
              onChange={(e) => p.onQuery(e.target.value)}
              placeholder={l.placeholder}
              aria-label={l.label}
              maxLength={p.maxLength}
              autoFocus
              autoComplete="off"
              enterKeyHint="search"
              className="h-[44px] w-full rounded-full border border-feed-line bg-feed-card pl-[42px] pr-[44px] text-[15px] text-feed-text outline-none placeholder:text-feed-muted focus:border-kink-gold-bright [&::-webkit-search-cancel-button]:hidden"
            />
            {p.query ? (
              <button
                type="button"
                onClick={p.onClear}
                aria-label={l.clear}
                className="absolute right-[10px] top-1/2 grid size-[26px] -translate-y-1/2 place-items-center rounded-full bg-feed-chip text-[14px] leading-none text-feed-chip-text"
              >
                ×
              </button>
            ) : null}
          </label>
          <div role="tablist" className="flex gap-[8px] pt-[12px]">
            {p.tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={t.active}
                onClick={() => p.onTab(t.key)}
                className={`h-[32px] rounded-full px-[16px] text-[14px] font-semibold ${
                  t.active
                    ? "bg-kink-gold-bright text-kink-ink"
                    : "bg-feed-chip text-feed-chip-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {p.hint ? (
          <p className="px-[25px] py-[40px] text-center text-[14px] text-feed-muted">{p.hint}</p>
        ) : null}

        {p.people.shown ? <SearchPeople {...p.people} labels={l} /> : null}

        {p.postsShown ? (
          <section>
            {p.postsHeading ? (
              <h2 className="px-[18px] pb-[4px] pt-[16px] text-[17px] font-bold text-feed-text">
                {p.postsHeading}
              </h2>
            ) : null}
            <PostList {...p.posts} />
          </section>
        ) : null}
      </FeedShell>

      <GiftDialog {...p.giftDialog} />
      <CommentsPanel {...p.commentsPanel} />
      <MediaLightbox {...p.lightbox} />
      <ConfirmDialog {...p.confirm} />
      <Toast {...p.toast} />
    </>
  );
}
