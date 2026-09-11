import { useState } from "react";
import Link from "next/link";
import MaskIcon from "@/components/app/MaskIcon";
import MobileTabBar from "@/components/app/MobileTabBar";
import type { AppNavLabels, AppNavLinks } from "@/components/app/nav";
import type { FriendRowVM } from "@/domain/member";
import type { PeopleTabKey } from "@/presenters/usePeoplePresenter";

export interface PeopleViewProps {
  displayName: string;
  handle: string;
  backHref: string;
  activeTab: PeopleTabKey;
  onSelectTab: (tab: PeopleTabKey) => void;
  subTabs: Array<{
    key: PeopleTabKey;
    label: string;
    active: boolean;
  }>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  rows: FriendRowVM[];
  counts: {
    friends: string;
    followers: string;
    following: string;
    mutualFriends: string;
  };
  isSelf: boolean;
  loading: boolean;
  loadingList: boolean;
  error: string | null;
  onToggleFollow: (row: FriendRowVM) => void;
  labels: {
    follow: string;
    following: string;
    searchPlaceholder: string;
    loading: string;
  };
  viewerAvatarUrl?: string | null;
  links?: Pick<AppNavLinks, "home" | "chat" | "notifications" | "profile">;
  tabBarLabels?: Pick<AppNavLabels, "home" | "chat" | "notifications" | "profile">;
}

export default function PeopleView(p: PeopleViewProps) {
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const isFriendsActive = p.activeTab === "all" || p.activeTab === "mutual";
  const isFollowers = p.activeTab === "followers";
  const isFollowing = p.activeTab === "following";
  const isMutual = p.activeTab === "mutual";
  const isSuggested = p.activeTab === "suggested";

  const emptyTitle = isMutual
    ? "No mutual friends yet"
    : isFollowers
      ? "No followers yet"
      : isFollowing
        ? "Not following anyone yet"
        : isSuggested
          ? "No suggestions found"
          : "No friends yet";

  const emptySubtitle = isMutual
    ? "You and this member don't have mutual friends yet."
    : isFollowers
      ? "When people follow this profile, they will appear here."
      : isFollowing
        ? "Profiles this person follows will appear here."
        : isSuggested
          ? "We could not find members in this region right now."
          : "When mutual follows occur, they will appear here.";

  return (
    <main className="min-h-dvh bg-black text-white pb-[90px]">
      <div className="mx-auto w-full max-w-[440px] px-[16px] pt-[12px]">
        {/* Top Header */}
        <header className="flex items-center justify-between pb-[14px] pt-[4px]">
          <div className="flex items-center gap-[12px]">
            <Link
              href={p.backHref}
              aria-label="Go back"
              className="grid size-[36px] place-items-center rounded-full border border-neutral-800 bg-[#0e131d] text-white transition-colors hover:bg-neutral-800"
            >
              <MaskIcon name="chevron-right" width={18} className="rotate-180" />
            </Link>
            <div className="flex flex-col">
              <h1 className="text-[17px] font-bold leading-tight text-white">{p.displayName}</h1>
              <span className="text-[12px] text-neutral-400 leading-tight">{p.handle}</span>
            </div>
          </div>
        </header>

        {/* Search bar */}
        <div className="relative mb-[16px]">
          <div className="pointer-events-none absolute inset-y-0 left-[14px] flex items-center text-neutral-400">
            <MaskIcon name="search" width={16} />
          </div>
          <input
            type="text"
            value={p.searchQuery}
            onChange={(e) => p.onSearchChange(e.target.value)}
            placeholder={p.labels.searchPlaceholder}
            className="h-[42px] w-full rounded-[14px] border border-[#1b2333]/80 bg-[#0c101b] pl-[40px] pr-[36px] text-[13.5px] text-white placeholder-neutral-500 outline-none transition-colors focus:border-amber-400/60"
          />
          {p.searchQuery && (
            <button
              type="button"
              onClick={() => p.onSearchChange("")}
              aria-label="Clear search"
              className="absolute inset-y-0 right-[12px] my-auto flex size-[18px] items-center justify-center rounded-full bg-neutral-700 text-[10px] text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dark container */}
        <div className="overflow-hidden rounded-[22px] border border-[#1b2333]/80 bg-[#0c101b] p-[16px] shadow-xl">
          {/* Sub-tabs switcher (Friends | Followers | Following | Suggested) */}
          <div
            role="tablist"
            aria-label="People filter"
            className="flex items-center justify-between gap-[4px] overflow-x-auto pb-[16px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-[8px]"
          >
            {p.subTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={t.active}
                onClick={() => p.onSelectTab(t.key)}
                className={`shrink-0 whitespace-nowrap px-[2px] text-[12px] transition-colors sm:text-[13px] ${
                  t.active
                    ? "font-semibold text-amber-400"
                    : "font-medium text-neutral-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Mutual friends sub-filter when viewing another member on Friends */}
          {!p.isSelf && isFriendsActive && (
            <div className="mb-[14px] flex items-center gap-[8px]">
              <button
                type="button"
                onClick={() => p.onSelectTab("all")}
                className={`rounded-full px-[10px] py-[3px] text-[11.5px] font-medium transition-colors ${
                  !isMutual
                    ? "bg-kink-gold-bright font-bold text-black"
                    : "bg-[#141a26] text-neutral-400 hover:text-white"
                }`}
              >
                All Friends {p.counts.friends ? `(${p.counts.friends})` : ""}
              </button>
              <button
                type="button"
                onClick={() => p.onSelectTab("mutual")}
                className={`rounded-full px-[10px] py-[3px] text-[11.5px] font-medium transition-colors ${
                  isMutual
                    ? "bg-kink-gold-bright font-bold text-black"
                    : "bg-[#141a26] text-neutral-400 hover:text-white"
                }`}
              >
                Mutual Friends {p.counts.mutualFriends ? `(${p.counts.mutualFriends})` : ""}
              </button>
            </div>
          )}

          {/* Loading */}
          {(p.loading || p.loadingList) && (
            <div className="py-[36px] text-center text-[14px] text-neutral-400">
              {p.labels.loading}
            </div>
          )}

          {/* Error */}
          {p.error && !p.loading && !p.loadingList && (
            <div className="py-[36px] text-center text-[14px] text-red-400">{p.error}</div>
          )}

          {/* Empty */}
          {!p.loading && !p.loadingList && !p.error && p.rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-[40px]">
              <div className="flex flex-col items-center justify-center" aria-hidden="true">
                <div className="size-[48px] rounded-full bg-kink-gold-bright" />
                <div className="mt-[3px] h-[34px] w-[86px] rounded-t-[34px] bg-kink-gold-bright" />
              </div>

              <h2 className="mt-[18px] text-center text-[17px] font-bold text-white">
                {emptyTitle}
              </h2>

              <p className="mt-[6px] max-w-[260px] text-center text-[13px] leading-relaxed text-neutral-400">
                {emptySubtitle}
              </p>

              <Link
                href="/members"
                className="mt-[20px] flex h-[38px] w-[140px] items-center justify-center rounded-full bg-kink-gold-bright text-[13px] font-bold text-black shadow transition-opacity hover:opacity-95"
              >
                Find members
              </Link>
            </div>
          )}

          {/* Members list */}
          {!p.loading && !p.loadingList && !p.error && p.rows.length > 0 && (
            <ul className="flex flex-col gap-[14px]">
              {p.rows.map((r) => {
                const memberHref = r.username
                  ? `/u/${encodeURIComponent(r.username.replace(/^@/, ""))}`
                  : "#";
                const isFriend = r.isFollowing && !isFollowing;
                return (
                  <li key={r.userId} className="flex items-center justify-between gap-[12px]">
                    <Link
                      href={memberHref}
                      className="flex min-w-0 flex-1 items-center gap-[12px] transition-opacity hover:opacity-90"
                    >
                      <span className="relative size-[46px] shrink-0 overflow-hidden rounded-full border border-neutral-800/80 bg-[#161d2b]">
                        {r.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.avatarUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="grid size-full place-items-center text-neutral-400">
                            <MaskIcon name="people" width={22} />
                          </span>
                        )}
                      </span>

                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-bold leading-tight text-white">
                          {r.displayName}
                        </span>
                        {r.handle && (
                          <span className="mt-[2px] truncate text-[12.5px] font-normal leading-tight text-neutral-400">
                            {r.handle}
                          </span>
                        )}
                      </div>
                    </Link>

                    <div className="flex shrink-0 items-center gap-[6px]">
                      <button
                        type="button"
                        onClick={() => p.onToggleFollow(r)}
                        disabled={r.busy}
                        aria-pressed={r.isFollowing}
                        className={`rounded-[10px] px-[14px] py-[6px] text-[12px] font-medium transition-opacity disabled:opacity-50 ${
                          r.isFollowing
                            ? "border border-neutral-700/60 bg-[#161f30] text-neutral-300 hover:bg-[#1f2b42]"
                            : "bg-kink-gold-bright font-bold text-black hover:opacity-95"
                        }`}
                      >
                        {r.isFollowing
                          ? isFriend
                            ? "Friends"
                            : p.labels.following
                          : isSuggested
                            ? "Add Friend"
                            : p.labels.follow}
                      </button>

                      {/* 3-dots action menu (Add friend / Message / View profile) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuUserId((prev) => (prev === r.userId ? null : r.userId))}
                          aria-label="More options"
                          aria-expanded={menuUserId === r.userId}
                          className="grid size-[30px] place-items-center rounded-full text-neutral-400 transition-colors hover:text-white"
                        >
                          <MaskIcon name="more-vertical" width={16} />
                        </button>

                        {menuUserId === r.userId && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setMenuUserId(null)}
                              aria-hidden="true"
                            />
                            <div className="absolute right-0 top-[34px] z-50 w-[170px] rounded-[14px] border border-neutral-800 bg-[#0f1420] p-[6px] shadow-2xl">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuUserId(null);
                                  p.onToggleFollow(r);
                                }}
                                className="flex w-full items-center gap-[10px] rounded-[10px] px-[12px] py-[8px] text-left text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                              >
                                <MaskIcon name={r.isFollowing ? "user-check" : "person-add"} width={15} />
                                <span>{r.isFollowing ? (isFriend ? "Unfriend" : "Unfollow") : "Add friend"}</span>
                              </button>
                              {r.username && (
                                <Link
                                  href={`/messages?u=${encodeURIComponent(r.username.replace(/^@/, ""))}`}
                                  onClick={() => setMenuUserId(null)}
                                  className="flex w-full items-center gap-[10px] rounded-[10px] px-[12px] py-[8px] text-left text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                                >
                                  <MaskIcon name="message" width={15} />
                                  <span>Message</span>
                                </Link>
                              )}
                              {r.username && (
                                <Link
                                  href={`/u/${encodeURIComponent(r.username.replace(/^@/, ""))}`}
                                  onClick={() => setMenuUserId(null)}
                                  className="flex w-full items-center gap-[10px] rounded-[10px] px-[12px] py-[8px] text-left text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                                >
                                  <MaskIcon name="people" width={15} />
                                  <span>View profile</span>
                                </Link>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <MobileTabBar
        active="profile"
        avatarUrl={p.viewerAvatarUrl ?? null}
        links={p.links}
        labels={p.tabBarLabels}
      />
    </main>
  );
}
