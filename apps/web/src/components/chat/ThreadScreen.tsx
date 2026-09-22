import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";
import type { ThreadPeerVM, ThreadMessageVM } from "@/domain/chat";
import MessageBubble from "./MessageBubble";
import MessageComposer, { type MessageComposerProps } from "./MessageComposer";
import PresenceDot from "./PresenceDot";
import TypingDots from "./TypingDots";

export interface ThreadScreenProps {
  peer: ThreadPeerVM | null;
  messages: ThreadMessageVM[];
  loading: boolean;
  error: string | null;
  typing: boolean;
  typingLabel: string;
  onlineLabel: string;
  backHref: string;
  backLabel: string;
  emptyText: string;
  retryLabel: string;
  onSend: (body: string) => void;
  onTyping: (isTyping: boolean) => void;
  composer: Pick<MessageComposerProps, "placeholder" | "sendLabel" | "maxLength" | "disabled">;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreLabel: string;
  onLoadMore: () => void;
}

/**
 * One conversation. Mobile: back arrow + peer header + scrolling message list +
 * composer. Desktop: same layout, wider — a two-pane desktop view is a later
 * change that reuses this component as the right pane unchanged.
 */
export default function ThreadScreen(p: ThreadScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col border-x border-app-line lg:mx-auto lg:max-w-[640px]">
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
            {p.peer?.displayName ?? "Conversation"}
          </p>
          {p.peer?.isOnline && <p className="text-[12px] text-app-online">{p.onlineLabel}</p>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-app-page">
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
          <p className="px-[20px] py-[40px] text-center text-[14px] font-semibold text-[#e5484d]">
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
            <MessageBubble key={m.clientId ?? m.id} message={m} retryLabel={p.retryLabel} />
          ))}
        </ul>
        <TypingDots visible={p.typing} label={p.typingLabel} />
      </div>

      <MessageComposer onSend={p.onSend} onTyping={p.onTyping} {...p.composer} />
    </div>
  );
}
