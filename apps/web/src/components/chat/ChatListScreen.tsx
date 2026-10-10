"use client";

import { useRef } from "react";
import Link from "next/link";
import { MoreVertical, Search, X } from "lucide-react";
import ConversationRow from "./ConversationRow";
import type { ChatInboxFilter, ConversationRowVM } from "@/domain/chat";

export interface ChatListScreenProps {
  rows: ConversationRowVM[];
  loading: boolean;
  error: string | null;
  empty: boolean;
  heading: string;
  banner?: React.ReactNode;
  loadingText: string;
  emptyTitle: string;
  emptyBody: string;
  onlineLabel: string;
  query: string;
  onQuery: (value: string) => void;
  filters: { key: ChatInboxFilter; label: string; count: string; active: boolean }[];
  onFilter: (filter: ChatInboxFilter) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onNavigation: () => void;
  newChatHref: string;
  settingsHref: string;
  copy: {
    search: string;
    searchLabel: string;
    clear: string;
    filtersLabel: string;
    menu: string;
    navigation: string;
    newChat: string;
    settings: string;
    sent: string;
    unread: string;
  };
}

export default function ChatListScreen(p: ChatListScreenProps) {
  const input = useRef<HTMLInputElement>(null);
  const tool =
    "grid size-[34px] place-items-center rounded-full bg-app-input text-kink-gold-bright transition-colors hover:bg-app-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-kink-gold-bright";
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-app-surface lg:mx-auto lg:max-w-[640px] lg:border-x lg:border-app-line">
      <header className="px-[18px] pb-[10px] pt-[16px]">
        <div className="flex items-center justify-between gap-[12px]">
          <h1 className="text-[28px] font-bold tracking-tight text-kink-gold-bright">
            {p.heading}
          </h1>
          <div className="relative flex items-center gap-[6px]">
            <button
              type="button"
              className={tool}
              aria-label={p.copy.searchLabel}
              onClick={() => input.current?.focus()}
            >
              <Search size={18} />
            </button>
            <button
              type="button"
              className={tool}
              aria-label={p.copy.menu}
              aria-expanded={p.menuOpen}
              onClick={p.onToggleMenu}
            >
              <MoreVertical size={20} />
            </button>
            {p.menuOpen && (
              <div className="absolute right-0 top-[42px] z-20 min-w-[180px] rounded-xl border border-app-line bg-app-surface p-[4px] text-[14px] text-app-text shadow-lg">
                <Link
                  className="block rounded-lg px-[12px] py-[10px] hover:bg-app-input"
                  href={p.newChatHref}
                >
                  {p.copy.newChat}
                </Link>
                <Link
                  className="block rounded-lg px-[12px] py-[10px] hover:bg-app-input"
                  href={p.settingsHref}
                >
                  {p.copy.settings}
                </Link>
                <button
                  type="button"
                  className="w-full rounded-lg px-[12px] py-[10px] text-left hover:bg-app-input"
                  onClick={p.onNavigation}
                >
                  {p.copy.navigation}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-[12px] flex h-[38px] items-center gap-[8px] rounded-full bg-app-input px-[12px] text-app-muted">
          <Search size={16} aria-hidden="true" />
          <input
            ref={input}
            type="search"
            aria-label={p.copy.searchLabel}
            placeholder={p.copy.search}
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-app-text outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          {p.query && (
            <button type="button" aria-label={p.copy.clear} onClick={() => p.onQuery("")}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="mt-[12px] flex gap-[6px]" role="group" aria-label={p.copy.filtersLabel}>
          {p.filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              aria-pressed={filter.active}
              aria-label={`${filter.label} ${filter.count}`}
              onClick={() => p.onFilter(filter.key)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-[5px] rounded-full border px-[7px] py-[7px] text-[12px] sm:text-[13px] ${filter.active ? "border-kink-gold-bright bg-kink-gold-bright font-bold text-kink-ink" : "border-app-line bg-app-surface text-app-text"}`}
            >
              {filter.key === "online" && (
                <span
                  className="size-[6px] shrink-0 rounded-full bg-app-online"
                  aria-hidden="true"
                />
              )}
              {filter.label}
              <span className={filter.active ? "text-kink-ink" : "text-app-muted"}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </header>
      {p.banner}
      {p.loading && (
        <p className="px-[20px] py-[40px] text-center text-[14px] text-app-muted">
          {p.loadingText}
        </p>
      )}
      {p.error && !p.loading && (
        <p className="px-[20px] py-[40px] text-center text-[14px] font-semibold text-app-danger">
          {p.error}
        </p>
      )}
      {p.empty && (
        <div className="px-[20px] py-[48px] text-center">
          <p className="text-[16px] font-bold text-app-text">{p.emptyTitle}</p>
          <p className="pt-[6px] text-[14px] text-app-muted">{p.emptyBody}</p>
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto px-[10px]">
        {p.rows.map((row) => (
          <ConversationRow
            key={row.id}
            row={row}
            onlineLabel={p.onlineLabel}
            sentLabel={p.copy.sent}
            unreadLabel={p.copy.unread}
          />
        ))}
      </ul>
    </div>
  );
}
