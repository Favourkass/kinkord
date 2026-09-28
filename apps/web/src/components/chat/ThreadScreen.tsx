"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";
import type { ThreadMessageVM, ThreadPeerVM } from "@/domain/chat";
import MessageBubble from "./MessageBubble";
import MessageComposer, { type MessageComposerProps } from "./MessageComposer";
import PresenceDot from "./PresenceDot";

export interface ThreadScreenProps {
  peer: ThreadPeerVM | null;
  messages: ThreadMessageVM[];
  loading: boolean;
  error: string | null;
  sendError: string | null;
  unavailable: boolean;
  unavailableText: string;
  onlineLabel: string;
  backHref: string;
  backLabel: string;
  emptyText: string;
  retryLabel: string;
  onSend: (body: string) => void;
  onRetry: (clientId: string) => void;
  composer: Pick<MessageComposerProps, "placeholder" | "sendLabel" | "maxLength">;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreLabel: string;
  onLoadMore: () => void;
}

/**
 * One conversation: header, scrolling messages, composer. The list follows the
 * newest message as it arrives, unless the reader has scrolled up to read
 * history, in which case it stays where they are.
 */
export default function ThreadScreen(p: ThreadScreenProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const count = p.messages.length;

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col border-x border-app-line lg:mx-auto lg:max-w-[640px]">
      <header className="flex items-center gap-[12px] border-b border-app-line bg-app-surface px-[16px] py-[10px]">
        <Link
          href={p.backHref}
          aria-label={p.backLabel}
          className="grid size-[36px] place-items-center rounded-full text-app-text lg:hidden"
        >
          <MaskIcon name="chevron-right" width={20} className="rotate-180" />
        </Link>
        <span className="relative shrink-0">
          <AvatarCircle
            src={p.peer?.avatarUrl ?? null}
            alt=""
            size={38}
            ringClassName="bg-app-line"
          />
          <PresenceDot
            online={Boolean(p.peer?.isOnline)}
            label={p.onlineLabel}
            className="absolute -bottom-[1px] -right-[1px]"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-app-text">
            {p.peer?.displayName ?? (p.loading ? "…" : "Member")}
          </p>
          {p.peer?.isOnline && <p className="text-[12px] text-app-online">{p.onlineLabel}</p>}
        </div>
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
            />
          ))}
        </ul>
      </div>

      {p.sendError && (
        <p className="border-t border-app-line bg-app-surface px-[16px] pt-[8px] text-[12px] text-app-danger">
          {p.sendError}
        </p>
      )}
      {p.unavailable ? (
        <p className="border-t border-app-line bg-app-surface px-[16px] py-[14px] text-center text-[13px] text-app-muted">
          {p.unavailableText}
        </p>
      ) : (
        <MessageComposer
          onSend={p.onSend}
          disabled={p.loading || Boolean(p.error)}
          {...p.composer}
        />
      )}
    </div>
  );
}
