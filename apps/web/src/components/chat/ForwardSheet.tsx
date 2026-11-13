"use client";

import { useEffect } from "react";
import { Check, Search } from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { ForwardChatVM } from "@/domain/chat";

export interface ForwardSheetProps {
  title: string;
  searchLabel: string;
  query: string;
  onQuery: (query: string) => void;
  loading: boolean;
  chats: ForwardChatVM[];
  emptyText: string;
  /** "2 of 5 chosen". */
  chosenLabel: string;
  /** Beside a chat the copy reached, after a forward some chats refused. */
  sentLabel: string;
  sendLabel: string;
  canSend: boolean;
  cancelLabel: string;
  error: string | null;
  onToggle: (conversationId: string) => void;
  onSend: () => void;
  onClose: () => void;
}

/** Choosing up to five chats to forward a message to, from the inbox or a search. */
export default function ForwardSheet(p: ForwardSheetProps) {
  const { onClose } = p;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      onClick={onClose}
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center sm:p-[24px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-[440px] flex-col rounded-t-[20px] bg-app-surface pb-[env(safe-area-inset-bottom)] sm:rounded-[20px]"
      >
        <div className="px-[20px] pt-[18px]">
          <h2 className="text-[18px] font-bold text-app-text">{p.title}</h2>
          <label className="mt-[12px] flex items-center gap-[8px] rounded-full bg-app-input px-[14px]">
            <Search size={17} className="shrink-0 text-app-muted" aria-hidden />
            <input
              type="search"
              value={p.query}
              onChange={(e) => p.onQuery(e.target.value)}
              placeholder={p.searchLabel}
              aria-label={p.searchLabel}
              maxLength={100}
              className="min-w-0 flex-1 bg-transparent py-[10px] text-[16px] text-app-text outline-none placeholder:text-app-muted"
            />
          </label>
        </div>
        <ul className="mt-[8px] min-h-[120px] flex-1 overflow-y-auto px-[8px]">
          {p.loading ? (
            <li className="px-[12px] py-[24px] text-center text-[14px] text-app-muted">…</li>
          ) : p.chats.length === 0 ? (
            <li className="px-[12px] py-[24px] text-center text-[14px] text-app-muted">
              {p.emptyText}
            </li>
          ) : (
            p.chats.map((c) => (
              <li key={c.id}>
                <label
                  className={`flex items-center gap-[12px] rounded-[12px] px-[12px] py-[8px] hover:bg-app-input ${
                    c.disabled ? "cursor-default opacity-45" : "cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={c.selected}
                    disabled={c.disabled}
                    onChange={() => p.onToggle(c.id)}
                    className="peer sr-only"
                  />
                  <AvatarCircle
                    silver={c.silver}
                    src={c.avatarUrl}
                    alt=""
                    size={40}
                    ringClassName="bg-app-line"
                    shape={c.organization ? "square" : "circle"}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[15px] font-semibold ${c.organization ? "text-kink-gold-bright" : "text-app-text"}`}
                    >
                      {c.displayName}
                    </span>
                    {c.result?.sent === false && (
                      <span className="line-clamp-2 block text-[12px] text-app-danger">
                        {c.result.error}
                      </span>
                    )}
                    {c.result?.sent && (
                      <span className="block text-[12px] text-app-online">{p.sentLabel}</span>
                    )}
                  </span>
                  <span
                    aria-hidden
                    className={`grid size-[22px] shrink-0 place-items-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-kink-gold-bright ${
                      c.selected
                        ? "border-kink-gold-bright bg-kink-gold-bright text-kink-ink"
                        : "border-app-line"
                    }`}
                  >
                    {c.selected && <Check size={14} strokeWidth={3} />}
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>
        {p.error && <p className="px-[20px] pt-[8px] text-[13px] text-app-danger">{p.error}</p>}
        <div className="flex items-center gap-[10px] border-t border-app-line px-[20px] py-[12px]">
          <span className="min-w-0 flex-1 text-[13px] text-app-muted">{p.chosenLabel}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-[14px] py-[9px] text-[14px] font-medium text-app-muted"
          >
            {p.cancelLabel}
          </button>
          <button
            type="button"
            onClick={p.onSend}
            disabled={!p.canSend}
            className="rounded-full bg-kink-gold-bright px-[18px] py-[9px] text-[14px] font-bold text-kink-ink disabled:opacity-45"
          >
            {p.sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
