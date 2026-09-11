import { useState } from "react";
import { Copy } from "lucide-react";
import MaskIcon from "@/components/app/MaskIcon";
import type { PublicProfileVM } from "@/domain/member";

export interface ProfileHeroLabels {
  follow: string;
  following: string;
  message: string;
  yourself: string;
  editProfile: string;
  addToStory?: string;
  stats: { friends: string; followers: string; following: string };
}

export interface ProfileHeroProps {
  vm: PublicProfileVM;
  /** "Online" / "Last seen an hour ago"; null when never seen. */
  presenceText: string | null;
  labels: ProfileHeroLabels;
  messageHref: string;
  editHref: string;
  onToggleFollow: () => void;
  followBusy: boolean;
  onSelectStatsTab?: (sub: "all" | "followers" | "following") => void;
  onShare?: () => void;
}

export default function ProfileHero({
  vm,
  presenceText,
  labels,
  messageHref,
  editHref,
  onToggleFollow,
  followBusy,
  onSelectStatsTab,
  onShare,
}: ProfileHeroProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section>
      <div className="relative h-[240px]">
        {/* Cover banner */}
        <div className="h-[180px] w-full overflow-hidden bg-[#18181b]">
          {vm.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vm.coverUrl}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="size-full object-cover"
            />
          )}
        </div>

        {/* Avatar overlay with sleek dark border ring */}
        <div className="absolute left-[20px] top-[114px] size-[110px]">
          <div className="relative size-[110px] overflow-hidden rounded-full border-[3.5px] border-[#080a10] bg-black shadow-xl">
            {vm.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vm.avatarUrl}
                alt={vm.displayName}
                fetchPriority="high"
                decoding="async"
                className="size-full object-cover"
              />
            ) : (
              <span className="grid size-full place-items-center bg-[#141310] text-pf-muted">
                <MaskIcon name="people" width={44} />
              </span>
            )}
          </div>

          {/* Person icon on the profile photo for friends:
              Only marked if viewer is friends with that person (mutual follows) */}
          {!vm.isSelf && (
            <button
              type="button"
              onClick={onToggleFollow}
              disabled={followBusy}
              aria-label={vm.isFriend ? "Friends" : "Add friend"}
              title={vm.isFriend ? "Friends (Mutual)" : "Add friend"}
              className={`absolute bottom-[2px] right-[2px] grid size-[32px] place-items-center rounded-full border-2 border-[#080a10] shadow-md transition-all ${
                vm.isFriend
                  ? "bg-kink-gold-bright text-black ring-2 ring-amber-400/30"
                  : "bg-[#141a26] text-neutral-300 hover:bg-[#1f283a] hover:text-white"
              }`}
            >
              <MaskIcon name={vm.isFriend ? "user-check" : "people"} width={16} />
            </button>
          )}
        </div>

        {/* Last seen label */}
        {presenceText && (
          <p className="absolute right-[16px] top-[188px] text-[12px] italic leading-[15px] text-neutral-400">
            {presenceText}
          </p>
        )}
      </div>

      {/* Profile details */}
      <div className="flex flex-col items-center gap-[8px] px-[16px] pb-[16px]">
        {/* Name and Handle */}
        <div className="flex flex-wrap items-center justify-center gap-[6px] text-center">
          <span className="text-[22px] font-bold leading-[27px] text-white">{vm.displayName}</span>
          {vm.handle && (
            <span className="text-[16px] leading-[19px] text-neutral-400">· {vm.handle}</span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-[10px] text-[13.5px] font-medium leading-[17px] text-neutral-300">
          <button
            type="button"
            onClick={() => onSelectStatsTab?.("all")}
            className="transition-colors hover:text-white"
          >
            {vm.stats.friends} {labels.stats.friends}
          </button>
          <span aria-hidden className="text-neutral-500">
            ·
          </span>
          <button
            type="button"
            onClick={() => onSelectStatsTab?.("followers")}
            className="transition-colors hover:text-white"
          >
            {vm.stats.followers} {labels.stats.followers}
          </button>
          <span aria-hidden className="text-neutral-500">
            ·
          </span>
          <button
            type="button"
            onClick={() => onSelectStatsTab?.("following")}
            className="transition-colors hover:text-white"
          >
            {vm.stats.following} {labels.stats.following}
          </button>
        </div>

        {/* Location with gold pin */}
        {vm.locationLine && (
          <p className="flex items-center justify-center gap-[5px] text-[13px] font-medium text-neutral-200">
            <MaskIcon name="map-pin" width={14} className="text-kink-gold-bright" />
            <span>{vm.locationLine}</span>
          </p>
        )}

        {/* Age / Roles Tagline: "25F · Dominant | Sadist" */}
        {vm.tagLine ? (
          <p className="text-[14px] font-semibold leading-[18px] text-neutral-200">{vm.tagLine}</p>
        ) : vm.ageTag ? (
          <p className="text-[14px] font-semibold leading-[18px] text-neutral-200">{vm.ageTag}</p>
        ) : null}

        {vm.isSelf && <p className="text-[12px] text-pf-muted">{labels.yourself}</p>}
      </div>

      {/* Action buttons */}
      <div className="flex gap-[12px] px-[16px] pb-[20px]">
        {vm.isSelf ? (
          <>
            <button
              type="button"
              onClick={onShare}
              className="flex h-[42px] flex-1 items-center justify-center rounded-[16px] bg-kink-gold-bright text-[14px] font-bold text-black shadow transition-opacity hover:opacity-95"
            >
              {labels.addToStory ?? "Add to story"}
            </button>
            <a
              href={editHref}
              className="flex h-[42px] flex-1 items-center justify-center gap-[8px] rounded-[16px] border border-neutral-800 bg-[#0c0f17] text-[14px] font-semibold text-white shadow transition-colors hover:bg-neutral-800"
            >
              <svg
                className="size-[15px] shrink-0 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
              <span>{labels.editProfile}</span>
            </a>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleFollow}
              disabled={followBusy}
              aria-pressed={vm.isFollowing}
              className={`flex h-[42px] flex-1 items-center justify-center gap-[8px] rounded-[16px] text-[14px] font-bold shadow transition-opacity hover:opacity-95 disabled:opacity-60 ${
                vm.isFollowing
                  ? "border border-neutral-800 bg-[#0c0f17] text-white"
                  : "bg-kink-gold-bright text-black"
              }`}
            >
              <MaskIcon name={vm.isFollowing ? "user-check" : "person-add"} width={16} />
              {vm.isFollowing ? (vm.isFriend ? "Friends" : labels.following) : labels.follow}
            </button>
            <a
              href={messageHref}
              className="flex h-[42px] flex-1 items-center justify-center gap-[8px] rounded-[16px] border border-neutral-800 bg-[#0c0f17] text-[14px] font-semibold text-white shadow transition-colors hover:bg-neutral-800"
            >
              <MaskIcon name="message" width={16} />
              {labels.message}
            </a>

            {/* Arrow action button (Share / Add friend / Copy link) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="More options"
                aria-expanded={menuOpen}
                className="grid size-[42px] shrink-0 place-items-center rounded-[16px] border border-neutral-800 bg-[#0c0f17] text-white shadow transition-colors hover:bg-neutral-800"
              >
                <svg
                  className="size-[16px] text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-[48px] z-50 w-[180px] rounded-[14px] border border-neutral-800 bg-[#0f1420] p-[6px] shadow-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleFollow();
                      }}
                      className="flex w-full items-center gap-[10px] rounded-[10px] px-[12px] py-[8px] text-left text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                    >
                      <MaskIcon name={vm.isFriend ? "user-check" : "person-add"} width={16} />
                      <span>{vm.isFriend ? "Remove friend" : "Add friend"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onShare?.();
                      }}
                      className="flex w-full items-center gap-[10px] rounded-[10px] px-[12px] py-[8px] text-left text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                    >
                      <MaskIcon name="nav-share" width={16} />
                      <span>Share profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        if (typeof window !== "undefined" && navigator.clipboard) {
                          void navigator.clipboard.writeText(window.location.href);
                        }
                      }}
                      className="flex w-full items-center gap-[10px] rounded-[10px] px-[12px] py-[8px] text-left text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                    >
                      <Copy className="size-[16px] shrink-0" />
                      <span>Copy link</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
