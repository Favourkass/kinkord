"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";
import VerifiedCheck from "@/components/app/VerifiedCheck";
import SilverCheck from "@/components/app/SilverCheck";
import ConfirmDialog, { type ConfirmDialogProps } from "@/components/feed/ConfirmDialog";
import MediaLightbox from "@/components/feed/MediaLightbox";
import type { ThreadMessageVM, ThreadPeerVM } from "@/domain/chat";
import type { PostMediaVM } from "@/domain/post";
import MessageBubble, { type MessageBubblePhotoLabels } from "./MessageBubble";
import MessageComposer, { type MessageComposerProps } from "./MessageComposer";
import PresenceDot from "./PresenceDot";
import ReportSheet, { type ReportSheetProps } from "./ReportSheet";
import ThreadMenu, { type ThreadMenuProps } from "./ThreadMenu";
import { useVisibleViewport } from "./useVisibleViewport";

export interface ThreadScreenProps {
  peer: ThreadPeerVM | null;
  messages: ThreadMessageVM[];
  loading: boolean;
  error: string | null;
  sendError: string | null;
  unavailable: boolean;
  unavailableText: string;
  /**
   * Today's new-chat allowance, while nobody has written yet: a hint above the
   * composer, or, once it's used, a notice in place of it.
   */
  newChat: { text: string; blocking: boolean } | null;
  onlineLabel: string;
  backHref: string;
  backLabel: string;
  emptyText: string;
  retryLabel: string;
  onSend: (body: string) => void;
  onRetry: (clientId: string) => void;
  composer: Pick<
    MessageComposerProps,
    "placeholder" | "sendLabel" | "maxLength" | "photo" | "onTyping"
  >;
  /** Why photos aren't open yet, after the member tried to add one. */
  photoNotice: string | null;
  photoLabels: MessageBubblePhotoLabels;
  onRevealPhoto: (messageId: string) => void;
  onOpenPhoto: (src: string) => void;
  /** The photo open full size, if any. */
  viewingPhoto: PostMediaVM | null;
  photoCloseLabel: string;
  onClosePhoto: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreLabel: string;
  onLoadMore: () => void;
  /** Report or block the other member; null once they're gone. */
  menu: ThreadMenuProps | null;
  /** In place of the composer while the viewer has them blocked. */
  blocked: { text: string; actionLabel: string; busy: boolean; onAction: () => void } | null;
  blockDialog: Omit<ConfirmDialogProps, "open"> | null;
  report: ReportSheetProps | null;
  safetyError: string | null;
}

/**
 * One conversation: header, scrolling messages, composer. The list follows the
 * newest message as it arrives, unless the reader has scrolled up to read
 * history, in which case it stays where they are.
 *
 * On a phone the thread is its own full-screen layer, sized to the part of the
 * screen the keyboard leaves visible: the header stays put, only the messages
 * scroll, and the composer sits on the keyboard. The page behind can't scroll
 * it away. On desktop it's a column in the page, as before.
 *
 * Someone else's photos arrive blurred: a first tap shows the photo, the next
 * opens it full size.
 */
export default function ThreadScreen(p: ThreadScreenProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const count = p.messages.length;
  const viewport = useVisibleViewport();

  // New messages, and the keyboard opening, both keep the newest one in view.
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [count, viewport?.height]);

  // Who the thread is with. Tapping them opens their profile.
  const who = (
    <>
      <span className="relative shrink-0">
        <AvatarCircle
          src={p.peer?.avatarUrl ?? null}
          alt=""
          size={38}
          ringClassName="bg-app-line"
        />
        <PresenceDot
          online={Boolean(p.peer?.isOnline)}
          status={p.peer?.presence}
          label={p.peer?.presenceLabel ?? p.onlineLabel}
          className="absolute -bottom-[1px] -right-[1px]"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-[3px]">
          <span className="truncate text-[15px] font-bold text-app-text">
            {p.peer?.displayName ?? (p.loading ? "…" : "Member")}
          </span>
          {p.peer?.verified && p.peer.verifiedLabel ? (
            <VerifiedCheck label={p.peer.verifiedLabel} />
          ) : null}
          {p.peer?.silver ? <SilverCheck size={15} /> : null}
        </span>
        {p.peer && (
          <span
            className={`block text-[12px] ${p.peer.typing || p.peer.presence === "online" ? "text-app-online" : p.peer.presence === "away" ? "text-amber-400" : "text-app-muted"}`}
          >
            {p.peer.presenceLabel ?? p.onlineLabel}
          </span>
        )}
      </span>
    </>
  );

  const fit = viewport
    ? ({
        "--thread-h": `${viewport.height}px`,
        "--thread-top": `${viewport.top}px`,
      } as CSSProperties)
    : undefined;

  return (
    <>
      <div
        style={fit}
        className="fixed inset-x-0 top-0 z-30 flex h-[var(--thread-h,100dvh)] w-full translate-y-[var(--thread-top,0px)] flex-col bg-app-page pt-[env(safe-area-inset-top)] lg:static lg:z-auto lg:mx-auto lg:h-auto lg:min-h-0 lg:max-w-[640px] lg:flex-1 lg:translate-y-0 lg:border-x lg:border-app-line lg:bg-transparent lg:pt-0"
      >
        <header className="flex items-center gap-[12px] border-b border-app-line bg-app-surface px-[16px] py-[10px]">
          <Link
            href={p.backHref}
            aria-label={p.backLabel}
            className="grid size-[36px] place-items-center rounded-full text-app-text lg:hidden"
          >
            <MaskIcon name="chevron-right" width={20} className="rotate-180" />
          </Link>
          {p.peer ? (
            // select-none: a long press opens the link's menu rather than
            // selecting the name (and Android's "Tap to search" with it).
            <Link
              href={p.peer.profileHref}
              className="flex min-w-0 flex-1 select-none items-center gap-[12px] rounded-[12px]"
            >
              {who}
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 select-none items-center gap-[12px]">{who}</div>
          )}
          {p.menu && <ThreadMenu {...p.menu} />}
        </header>

        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="min-h-0 flex-1 overflow-y-auto bg-app-page"
        >
          {p.hasMore && (
            <div className="py-[10px] text-center">
              <button
                type="button"
                onClick={p.onLoadMore}
                disabled={p.loadingMore}
                className="text-[12px] font-medium text-app-muted hover:underline"
              >
                {p.loadingMore ? "…" : p.loadMoreLabel}
              </button>
            </div>
          )}
          {p.loading && (
            <p className="px-[20px] py-[40px] text-center text-[14px] text-app-muted">…</p>
          )}
          {p.error && !p.loading && (
            <p className="px-[20px] py-[40px] text-center text-[14px] font-semibold text-app-danger">
              {p.error}
            </p>
          )}
          {!p.loading && !p.error && p.messages.length === 0 && (
            <p className="px-[20px] py-[48px] text-center text-[13px] text-app-muted">
              {p.emptyText}
            </p>
          )}
          <ul className="py-[10px]">
            {p.messages.map((m) => (
              <MessageBubble
                key={m.clientId ?? m.id}
                message={m}
                retryLabel={p.retryLabel}
                onRetry={p.onRetry}
                photoLabels={p.photoLabels}
                onRevealPhoto={p.onRevealPhoto}
                onOpenPhoto={p.onOpenPhoto}
              />
            ))}
          </ul>
        </div>

        {(p.sendError || p.safetyError) && (
          <p className="border-t border-app-line bg-app-surface px-[16px] pt-[8px] text-[12px] text-app-danger">
            {p.safetyError ?? p.sendError}
          </p>
        )}
        {p.blocked && !p.unavailable ? (
          <div className="flex items-center gap-[12px] border-t border-app-line bg-app-surface px-[16px] py-[12px] pb-[calc(12px+env(safe-area-inset-bottom))]">
            <p className="min-w-0 flex-1 text-[13px] text-app-muted">{p.blocked.text}</p>
            <button
              type="button"
              onClick={p.blocked.onAction}
              disabled={p.blocked.busy}
              className="shrink-0 rounded-full border border-app-line px-[14px] py-[7px] text-[13px] font-bold text-app-text disabled:opacity-50"
            >
              {p.blocked.actionLabel}
            </button>
          </div>
        ) : p.unavailable || p.newChat?.blocking ? (
          <p className="border-t border-app-line bg-app-surface px-[16px] py-[14px] text-center text-[13px] text-app-muted">
            {p.unavailable ? p.unavailableText : p.newChat?.text}
          </p>
        ) : (
          <>
            {(p.newChat || p.photoNotice) && (
              <div className="space-y-[4px] border-t border-app-line bg-app-surface px-[16px] pt-[8px] text-[12px] text-app-muted">
                {p.newChat && <p>{p.newChat.text}</p>}
                {p.photoNotice && <p>{p.photoNotice}</p>}
              </div>
            )}
            <MessageComposer
              onSend={p.onSend}
              disabled={p.loading || Boolean(p.error)}
              {...p.composer}
            />
          </>
        )}
      </div>
      {/* Outside the thread layer: its keyboard offset would otherwise box a fixed overlay in. */}
      <MediaLightbox
        media={p.viewingPhoto}
        onClose={p.onClosePhoto}
        closeLabel={p.photoCloseLabel}
      />
      {p.blockDialog && <ConfirmDialog open {...p.blockDialog} />}
      {p.report && <ReportSheet {...p.report} />}
    </>
  );
}
