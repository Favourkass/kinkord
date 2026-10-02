"use client";

import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";
import type { CommentVM } from "@/domain/post";

export interface CommentsPanelProps {
  open: boolean;
  comments: CommentVM[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  maxLength: number;
  canSubmit: boolean;
  sending: boolean;
  onSubmit: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  viewerAvatarUrl: string | null;
  labels: {
    title: string;
    empty: string;
    placeholder: string;
    submit: string;
    delete: string;
    loadMore: string;
    loading: string;
    close: string;
  };
}

/**
 * Comments under a post: a bottom sheet on a phone, a centred panel on a wide
 * screen. Newest first, which is what the API returns — a fresh reply is the
 * first thing the author sees.
 */
export default function CommentsPanel(p: CommentsPanelProps) {
  if (!p.open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.labels.title}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center sm:p-[24px]"
    >
      <div className="flex max-h-[85dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[20px] bg-feed-sheet sm:rounded-[20px]">
        <header className="flex items-center justify-between border-b border-feed-line px-[20px] py-[16px]">
          <h2 className="text-[16px] font-bold text-feed-text">{p.labels.title}</h2>
          <button
            type="button"
            onClick={p.onClose}
            aria-label={p.labels.close}
            className="text-feed-muted transition-colors hover:text-feed-text"
          >
            <MaskIcon src="/app/feed/icon-close.svg" width={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-[20px] py-[12px]">
          {p.error && <p className="py-[8px] text-[13px] font-medium text-[#e5484d]">{p.error}</p>}
          {p.comments.length === 0 && !p.loading && !p.error && (
            <p className="py-[24px] text-center text-[14px] text-feed-muted">{p.labels.empty}</p>
          )}
          <ul className="flex flex-col gap-[16px]">
            {p.comments.map((c) => (
              <li key={c.id} className="flex items-start gap-[10px]">
                <AvatarCircle src={c.avatarUrl} alt="" size={32} ringClassName="bg-feed-line" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-[8px]">
                    {c.authorHref ? (
                      <Link
                        href={c.authorHref}
                        className="text-[13px] font-bold text-feed-text hover:underline"
                      >
                        {c.authorName}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-bold text-feed-text">{c.authorName}</span>
                    )}
                    <span className="text-[11px] font-light text-feed-muted">{c.time}</span>
                  </p>
                  <p className="whitespace-pre-wrap pt-[2px] text-[14px] leading-[20px] text-feed-text">
                    {c.body}
                  </p>
                </div>
                {c.canDelete && (
                  <button
                    type="button"
                    onClick={() => p.onDelete(c.id)}
                    aria-label={p.labels.delete}
                    className="shrink-0 text-feed-muted transition-colors hover:text-[#e5484d]"
                  >
                    <MaskIcon src="/app/feed/icon-close.svg" width={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {p.loading && (
            <p className="py-[16px] text-center text-[13px] text-feed-muted">{p.labels.loading}</p>
          )}
          {p.hasMore && !p.loading && (
            <button
              type="button"
              onClick={p.onLoadMore}
              className="mx-auto mt-[16px] block text-[13px] font-medium text-feed-muted hover:underline"
            >
              {p.labels.loadMore}
            </button>
          )}
        </div>

        <footer className="flex items-center gap-[10px] border-t border-feed-line px-[20px] py-[12px]">
          <AvatarCircle
            src={p.viewerAvatarUrl}
            alt=""
            size={32}
            ringClassName="bg-kink-gold-bright"
          />
          <input
            value={p.draft}
            maxLength={p.maxLength}
            onChange={(e) => p.onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && p.canSubmit) {
                e.preventDefault();
                p.onSubmit();
              }
            }}
            placeholder={p.labels.placeholder}
            className="h-[36px] flex-1 rounded-[18px] border border-feed-line bg-feed-field px-[14px] text-[14px] text-feed-text outline-none placeholder:text-feed-muted"
          />
          <button
            type="button"
            onClick={p.onSubmit}
            disabled={!p.canSubmit}
            className="rounded-[8px] bg-kink-gold-bright px-[16px] py-[7px] text-[13px] font-bold text-kink-ink disabled:opacity-40"
          >
            {p.labels.submit}
          </button>
        </footer>
      </div>
    </div>
  );
}
