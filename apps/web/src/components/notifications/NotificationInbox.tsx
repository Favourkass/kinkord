import {
  AtSign,
  Bell,
  ThumbsUp,
  MessageCircleMore,
  MoreHorizontal,
  Repeat2,
  Search,
  ShieldCheck,
  BadgeCheck,
  Check,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { NotificationVM } from "@/domain/notification";
import AvatarCircle from "../app/AvatarCircle";

const ICONS = {
  message: MessageCircleMore,
  "person-add": FollowIcon,
  "friend-add": FriendRequestIcon,
  comment: MessageCircleMore,
  heart: ThumbsUp,
  repost: Repeat2,
  shield: ShieldCheck,
  bell: Bell,
  mention: AtSign,
};

export interface NotificationInboxProps {
  items: NotificationVM[];
  tabCounts: Record<"all" | "comment" | "mention", number>;
  tab: "all" | "comment" | "mention";
  setTab: (tab: "all" | "comment" | "mention") => void;
  query: string;
  setQuery: (query: string) => void;
  searchOpen: boolean;
  toggleSearch: () => void;
  menuId: string | null;
  setMenuId: (id: string | null) => void;
  deleteNotification: (id: string) => void;
  reportNotification: (id: string) => void;
  markRead: (id: string) => void;
  loading: boolean;
  loadingMore: boolean;
  opening: string | null;
  markingAll: boolean;
  error: string | null;
  unreadOnly: boolean;
  hasMore: boolean;
  hasUnread: boolean;
  onFilter: (unread: boolean) => void;
  onOpen: (id: string) => void;
  onMarkAll: () => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  copy: {
    title: string;
    subtitle: string;
    all: string;
    comments: string;
    mentions: string;
    search: string;
    menu: string;
    markRead: string;
    deleteNotification: string;
    reportNotification: string;
    openNotification: string;
    unread: string;
    unreadLabel: string;
    markAll: string;
    marking: string;
    loading: string;
    loadingMore: string;
    loadMore: string;
    emptyTitle: string;
    emptyBody: string;
    emptyUnread: string;
    emptySearch: string;
    emptyComments: string;
    emptyMentions: string;
    close: string;
    categories: string;
    retry: string;
    refresh: string;
    open: string;
  };
}

/** Flat inbox rows matching the supplied notification reference. */
export default function NotificationInbox(p: NotificationInboxProps) {
  const disabled = p.opening !== null || p.markingAll || p.loadingMore;
  return (
    <section
      aria-label={p.copy.title}
      className="mx-auto w-full max-w-[760px] bg-app-surface text-app-text lg:pb-12"
    >
      <header className="hidden h-20 items-center justify-between lg:flex">
        <h1 className="text-[28px] font-bold text-kink-gold-bright">{p.copy.title}</h1>
        <button
          type="button"
          aria-label={p.copy.search}
          aria-expanded={p.searchOpen}
          onClick={p.toggleSearch}
          className="grid size-11 place-items-center text-kink-gold-bright"
        >
          <Search size={26} />
        </button>
      </header>
      {p.searchOpen && (
        <div className="border-b border-app-card-border px-4 py-3">
          <input
            aria-label={p.copy.search}
            placeholder={p.copy.search}
            value={p.query}
            onChange={(event) => p.setQuery(event.target.value)}
            className="min-h-10 w-full rounded-lg border border-app-card-border bg-app-surface px-3 text-sm text-app-text outline-kink-gold-bright"
          />
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-app-subtle">
            <button
              type="button"
              aria-pressed={p.unreadOnly}
              onClick={() => p.onFilter(!p.unreadOnly)}
              className="min-h-9"
            >
              {p.unreadOnly ? p.copy.all : p.copy.unread}
            </button>
            <button
              type="button"
              onClick={p.onMarkAll}
              disabled={!p.hasUnread || disabled || p.loading}
              className="min-h-9 disabled:opacity-50"
            >
              {p.markingAll ? p.copy.marking : p.copy.markAll}
            </button>
            <button type="button" onClick={p.onRefresh} className="min-h-9">
              {p.copy.refresh}
            </button>
          </div>
        </div>
      )}
      <div
        role="group"
        aria-label={p.copy.categories}
        className="mx-4 my-3 flex min-h-11 items-center rounded-full border border-app-card-border bg-app-input p-0.5"
      >
        {(
          [
            ["all", p.copy.all],
            ["comment", p.copy.comments],
            ["mention", p.copy.mentions],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            aria-pressed={p.tab === tab}
            onClick={() => p.setTab(tab)}
            className={`flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-2 py-1 text-[12px] font-semibold focus-visible:outline-2 focus-visible:outline-kink-gold-bright min-[420px]:text-[14px] ${p.tab === tab ? "bg-gradient-to-b from-kink-gold-bright to-kink-amber text-black" : "text-app-text"}`}
          >
            {label}
            <span
              className={`grid min-w-5 h-5 px-1 place-items-center rounded-full text-[11px] leading-none ${p.tab === tab ? "bg-black text-kink-gold-bright" : "border border-app-subtle text-app-text"}`}
            >
              {p.tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>
      {p.error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-app-danger-soft px-4 py-3 text-sm text-app-danger"
        >
          <p>{p.error}</p>
          <button type="button" onClick={p.onRefresh} className="min-h-10 underline">
            {p.copy.retry}
          </button>
        </div>
      )}
      {p.loading ? (
        <p role="status" className="py-16 text-center text-sm text-app-subtle">
          {p.copy.loading}
        </p>
      ) : !p.items.length && !p.error ? (
        <div className="px-6 py-16 text-center">
          <Bell size={30} aria-hidden className="mx-auto text-kink-gold-bright" />
          <h2 className="mt-5 text-lg font-semibold">{p.copy.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-[340px] text-sm leading-6 text-app-subtle">
            {p.query
              ? p.copy.emptySearch
              : p.tab === "comment"
                ? p.copy.emptyComments
                : p.tab === "mention"
                  ? p.copy.emptyMentions
                  : p.unreadOnly
                    ? p.copy.emptyUnread
                    : p.copy.emptyBody}
          </p>
        </div>
      ) : (
        <ul aria-busy={p.loadingMore}>
          {p.items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li
                key={item.id}
                className="relative flex min-h-[67px] items-center border-b border-app-card-border px-4 lg:min-h-[88px]"
              >
                <button
                  type="button"
                  onClick={() => p.onOpen(item.id)}
                  disabled={disabled}
                  aria-label={`${item.body}. ${item.unread ? p.copy.unreadLabel : item.category}`}
                  className="flex min-h-[66px] min-w-0 flex-1 items-center gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-kink-gold-bright disabled:cursor-wait lg:min-h-[87px]"
                >
                  <span className="relative shrink-0">
                    {item.official ? (
                      <span className="grid size-[50px] place-items-center overflow-hidden rounded-full bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element -- local brand mark */}
                        <img
                          src="/icons/push-icon-v2.png"
                          alt=""
                          className="size-full object-contain"
                        />
                      </span>
                    ) : (
                      <AvatarCircle
                        src={item.avatarUrl}
                        alt=""
                        size={48}
                        ringClassName="bg-transparent"
                      />
                    )}
                    {item.official ? (
                      <span className="absolute bottom-0 right-0 grid size-[23px] place-items-center">
                        <BadgeCheck
                          size={23}
                          aria-hidden
                          className="fill-kink-gold-bright text-kink-gold-bright"
                        />
                        <Check
                          size={11}
                          strokeWidth={3}
                          aria-hidden
                          className="absolute text-white"
                        />
                      </span>
                    ) : (
                      <span className="absolute bottom-0 right-0 grid size-[23px] place-items-center rounded-full border-2 border-app-surface bg-kink-gold-bright text-black">
                        <Icon
                          size={13}
                          strokeWidth={2.25}
                          fill={item.icon === "heart" ? "currentColor" : "none"}
                          aria-hidden
                        />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[13px] font-medium leading-[19px] min-[420px]:text-[14px] lg:text-[16px]">
                      {item.actorName && (
                        <>
                          <strong className="font-extrabold">{item.actorName}</strong>{" "}
                        </>
                      )}
                      <span>{item.action}</span>
                    </span>
                    <time
                      dateTime={item.dateTime}
                      title={item.fullTime}
                      className="mt-1 block text-[11px] leading-4 text-app-subtle lg:text-[13px]"
                    >
                      {p.opening === item.id ? p.copy.open : item.time}
                    </time>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${p.copy.menu}: ${item.body}`}
                  aria-expanded={p.menuId === item.id}
                  onClick={() => p.setMenuId(p.menuId === item.id ? null : item.id)}
                  className="relative ml-1 grid min-h-11 w-6 shrink-0 place-items-center focus-visible:outline-2 focus-visible:outline-kink-gold-bright"
                >
                  <MoreHorizontal size={18} aria-hidden />
                  {item.unread && (
                    <span
                      aria-hidden
                      className="absolute right-0 top-1.5 size-[4px] rounded-full bg-kink-gold-bright"
                    />
                  )}
                </button>
                {p.menuId === item.id && (
                  <div className="absolute right-4 top-[52px] z-10 min-w-[170px] rounded-lg border border-app-card-border bg-app-surface p-1 text-sm shadow-xl">
                    <button
                      type="button"
                      onClick={() => p.onOpen(item.id)}
                      disabled={disabled}
                      className="block min-h-11 w-full px-3 text-left hover:bg-app-input"
                    >
                      {p.copy.openNotification}
                    </button>
                    {item.unread && (
                      <button
                        type="button"
                        onClick={() => p.markRead(item.id)}
                        disabled={disabled}
                        className="block min-h-11 w-full px-3 text-left hover:bg-app-input"
                      >
                        {p.copy.markRead}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => p.deleteNotification(item.id)}
                      disabled={disabled}
                      className="block min-h-11 w-full px-3 text-left text-app-danger hover:bg-app-input"
                    >
                      {p.copy.deleteNotification}
                    </button>
                    <button
                      type="button"
                      onClick={() => p.reportNotification(item.id)}
                      disabled={disabled}
                      className="block min-h-11 w-full px-3 text-left hover:bg-app-input"
                    >
                      {p.copy.reportNotification}
                    </button>
                    <button
                      type="button"
                      onClick={() => p.setMenuId(null)}
                      className="block min-h-9 w-full px-3 text-left text-app-subtle"
                    >
                      {p.copy.close}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!p.loading && p.hasMore && (
        <div className="py-5 text-center">
          <button
            type="button"
            onClick={p.onLoadMore}
            disabled={disabled}
            className="min-h-11 rounded-full border border-app-card-border px-6 text-sm text-app-text disabled:opacity-50"
          >
            {p.loadingMore ? p.copy.loadingMore : p.copy.loadMore}
          </button>
        </div>
      )}
    </section>
  );
}

/** A filled person inside a ring, matching the follow badge reference. */
function FollowIcon({ size = 13, strokeWidth = 2.25, ...props }: LucideProps) {
  return (
    <svg {...props} width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="12" cy="9" r="3" fill="currentColor" />
      <path d="M5 19a7 7 0 0 1 14 0 10 10 0 0 1-14 0Z" fill="currentColor" />
    </svg>
  );
}

/** Filled person plus a separate plus sign for friend requests. */
function FriendRequestIcon({ size = 13, strokeWidth = 2.25, ...props }: LucideProps) {
  return (
    <svg {...props} width={size} height={size} viewBox="0 0 24 24">
      <circle cx="8" cy="7" r="3.5" fill="currentColor" />
      <path d="M1 21v-2a7 7 0 0 1 14 0v2Z" fill="currentColor" />
      <path
        d="M19 10v8m-4-4h8"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
