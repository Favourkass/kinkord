import { useState } from "react";
import Link from "next/link";
import MaskIcon from "@/components/app/MaskIcon";
import type { FriendRowVM } from "@/domain/member";

export type FriendsSubTabKey = "all" | "mutual" | "followers" | "following" | "suggested";

export interface FriendsTabProps {
  heading: string;
  headingDesktop: string;
  activeSubTab?: FriendsSubTabKey;
  counts?: { friends: string; followers: string; following: string; mutualFriends?: string };
  subTabs: Array<{
    key: FriendsSubTabKey;
    label: string;
    active: boolean;
  }>;
  onSubTab: (key: FriendsSubTabKey) => void;
  rows: FriendRowVM[];
  labels: { follow: string; following: string; more: string; seeMore?: string };
  onToggleFollow: (row: FriendRowVM) => void;
  loading: boolean;
  loadingText: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  empty: string | null;
  error: string | null;
  exploreHref?: string;
  isSelf?: boolean;
}

/**
 * People / Friends card view matching the mobile UI design:
 * - Rounded dark card container (bg-[#0c101b] border-[#1b2333])
 * - Sub-tabs: Friends (1.2K), Followers(1K), Following(200), Suggested
 * - Member rows with circular avatars, white display names, muted @handles, Friends pill buttons, and 3-dots menus
 * - Centered "See more >" button
 * - Graceful empty state with gold silhouette icon
 */
export default function FriendsTab(p: FriendsTabProps) {
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const currentTab = p.activeSubTab ?? "all";
  const isFollowers = currentTab === "followers";
  const isFollowing = currentTab === "following";
  const isMutual = currentTab === "mutual";

  const emptyTitle =
    p.emptyTitle ??
    (isMutual
      ? "No mutual friends yet"
      : isFollowers
        ? "No followers yet"
        : isFollowing
          ? "Not following anyone yet"
          : "No friends yet");

  const emptySubtitle =
    p.emptySubtitle ??
    (isMutual
      ? "You and this member don't have mutual friends yet."
      : isFollowers
        ? "When people follow this profile, they will appear here."
        : isFollowing
          ? "Profiles this person follows will appear here."
          : "When mutual follows occur, they will appear here.");

  return (
    <div className="mx-auto w-full max-w-[440px] px-[16px] pb-[32px] pt-[8px]">
      {/* Dark rounded card container */}
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
              onClick={() => p.onSubTab(t.key)}
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
        {!p.isSelf && (currentTab === "all" || currentTab === "mutual") && (
          <div className="mb-[14px] flex items-center gap-[8px]">
            <button
              type="button"
              onClick={() => p.onSubTab("all")}
              className={`rounded-full px-[10px] py-[3px] text-[11.5px] font-medium transition-colors ${
                currentTab === "all"
                  ? "bg-kink-gold-bright font-bold text-black"
                  : "bg-[#141a26] text-neutral-400 hover:text-white"
              }`}
            >
              All Friends {p.counts?.friends ? `(${p.counts.friends})` : ""}
            </button>
            <button
              type="button"
              onClick={() => p.onSubTab("mutual")}
              className={`rounded-full px-[10px] py-[3px] text-[11.5px] font-medium transition-colors ${
                currentTab === "mutual"
                  ? "bg-kink-gold-bright font-bold text-black"
                  : "bg-[#141a26] text-neutral-400 hover:text-white"
              }`}
            >
              Mutual Friends {p.counts?.mutualFriends ? `(${p.counts.mutualFriends})` : ""}
            </button>
          </div>
        )}

        {/* Loading state */}
        {p.loading && (
          <div className="py-[32px] text-center text-[14px] text-neutral-400">
            {p.loadingText}
          </div>
        )}

        {/* Error state */}
        {p.error && !p.loading && (
          <div className="py-[32px] text-center text-[14px] text-red-400">
            {p.error}
          </div>
        )}

        {/* Empty state */}
        {!p.loading && !p.error && p.rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-[36px]">
            {/* Gold silhouette head & shoulders icon */}
            <div className="flex flex-col items-center justify-center" aria-hidden="true">
              <div className="size-[48px] rounded-full bg-kink-gold-bright" />
              <div className="mt-[3px] h-[34px] w-[86px] rounded-t-[34px] bg-kink-gold-bright" />
            </div>

            <h3 className="mt-[18px] text-center text-[17px] font-bold text-white">
              {emptyTitle}
            </h3>

            <p className="mt-[6px] max-w-[260px] text-center text-[13px] leading-relaxed text-neutral-400">
              {emptySubtitle}
            </p>

            <a
              href={p.exploreHref ?? "/members"}
              className="mt-[20px] flex h-[38px] w-[140px] items-center justify-center rounded-full bg-kink-gold-bright text-[13px] font-bold text-black shadow transition-opacity hover:opacity-95"
            >
              Find members
            </a>
          </div>
        )}

        {/* Populated list */}
        {!p.loading && !p.error && p.rows.length > 0 && (
          <>
            <ul className="flex flex-col gap-[14px]">
              {p.rows.map((r) => {
                const memberHref = r.username
                  ? `/u/${encodeURIComponent(r.username.replace(/^@/, ""))}`
                  : "#";
                const isFriend = r.isFollowing && currentTab !== "following";
                return (
                  <li key={r.userId} className="flex items-center justify-between gap-[12px]">
                    <Link
                      href={memberHref}
                      className="flex min-w-0 flex-1 items-center gap-[12px] transition-opacity hover:opacity-90"
                    >
                      {/* Circular avatar */}
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

                      {/* Member details: White name, muted gray @handle */}
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

                    {/* Right side: Action button + 3-dots menu */}
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
                          : currentTab === "suggested"
                            ? "Add Friend"
                            : p.labels.follow}
                      </button>

                      {/* 3-dots action menu (Add friend / Message / View profile) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuUserId((prev) => (prev === r.userId ? null : r.userId))}
                          aria-label={p.labels.more}
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

            {/* Bottom See more link */}
            <div className="pt-[16px]">
              <Link
                href={p.exploreHref ?? "/members"}
                className="flex w-full items-center justify-center gap-[6px] py-[4px] text-[13px] font-medium text-neutral-400 transition-colors hover:text-white"
              >
                <span>{p.labels.seeMore ?? "See more"}</span>
                <MaskIcon name="chevron-right" width={12} className="text-neutral-400" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
