import { useState } from "react";
import { Copy } from "lucide-react";
import MaskIcon from "@/components/app/MaskIcon";
import type { PublicProfileVM } from "@/domain/member";

export interface ProfileSideCardLabels {
  follow: string;
  following: string;
  message: string;
  yourself: string;
  editProfile: string;
  tagsHeading: string;
  stats: { friends: string; followers: string; following: string };
}

export interface ProfileSideCardProps {
  vm: PublicProfileVM;
  presenceText: string | null;
  labels: ProfileSideCardLabels;
  messageHref: string;
  editHref: string;
  onToggleFollow: () => void;
  followBusy: boolean;
  onShare?: () => void;
}

/** Figma desktop profile left column (987:5489): 340px card with cover, avatar, details and actions. */
export default function ProfileSideCard({
  vm,
  presenceText,
  labels,
  messageHref,
  editHref,
  onToggleFollow,
  followBusy,
  onShare,
}: ProfileSideCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <section className="flex flex-col gap-[24px] overflow-hidden rounded-[20px] border border-pf-border bg-pf-surface">
      <div className="relative h-[220px]">
        <div className="h-[140px] w-full overflow-hidden bg-kink-gold-bright">
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
        <div className="absolute left-[24px] top-[80px] size-[110px]">
          <span aria-hidden className="absolute inset-0 rounded-full bg-pf-surface" />
          {vm.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vm.avatarUrl}
              alt={vm.displayName}
              fetchPriority="high"
              decoding="async"
              className="absolute left-[5px] top-[8px] size-[100px] rounded-full object-cover"
            />
          ) : (
            <span className="absolute left-[5px] top-[8px] grid size-[100px] place-items-center rounded-full bg-pf-surface-2 text-pf-muted">
              <MaskIcon name="people" width={40} />
            </span>
          )}
          {!vm.isSelf && (
            <button
              type="button"
              onClick={onToggleFollow}
              disabled={followBusy}
              aria-label={vm.isFriend ? "Friends" : "Add friend"}
              title={vm.isFriend ? "Friends (Mutual)" : "Add friend"}
              className={`absolute left-[75px] top-[75px] grid size-[28px] place-items-center rounded-full border-2 border-pf-surface shadow transition-all ${
                vm.isFriend
                  ? "bg-kink-gold-bright text-black ring-2 ring-amber-400/30"
                  : "bg-[#141a26] text-neutral-300 hover:bg-[#1f283a] hover:text-white"
              }`}
            >
              <MaskIcon name={vm.isFriend ? "user-check" : "people"} width={14} />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-[16px] px-[24px] pb-[24px]">
        <div className="flex flex-col gap-[4px]">
          <p className="flex items-baseline gap-[6px]">
            <span className="text-[22px] font-bold leading-[27px] text-pf-text">
              {vm.displayName}
            </span>
            {vm.handle && (
              <span className="text-[15px] leading-[18px] text-pf-muted">{vm.handle}</span>
            )}
          </p>
          {presenceText && (
            <p className="text-[13px] leading-[16px] text-pf-muted">{presenceText}</p>
          )}
          {vm.isSelf && (
            <p className="text-[13px] leading-[16px] text-pf-muted">{labels.yourself}</p>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-[12px] text-[13px] leading-[16px]">
          <span className="font-bold text-pf-text">
            {vm.stats.friends} <span className="text-pf-muted">{labels.stats.friends}</span>
          </span>
          <span aria-hidden className="text-pf-muted">
            ·
          </span>
          <span className="font-bold text-pf-text">
            {vm.stats.followers} <span className="text-pf-muted">{labels.stats.followers}</span>
          </span>
          <span aria-hidden className="text-pf-muted">
            ·
          </span>
          <span className="font-bold text-pf-text">
            {vm.stats.following} <span className="text-pf-muted">{labels.stats.following}</span>
          </span>
        </p>
        {vm.locationLine && (
          <p className="flex items-center gap-[6px] text-[13px] font-semibold leading-[16px] text-pf-muted">
            <MaskIcon name="map-pin" width={14} className="text-kink-gold-bright" />
            {vm.locationLine}
          </p>
        )}
        {vm.tagLine && (
          <div className="flex flex-col gap-[8px] border-t border-pf-border pt-[8px]">
            <p className="text-[12px] font-bold uppercase leading-[15px] tracking-[0.48px] text-pf-muted">
              {labels.tagsHeading}
            </p>
            <p className="text-[14px] font-semibold leading-[17px] text-kink-gold-bright">
              {vm.tagLine}
            </p>
          </div>
        )}
        <div className="flex gap-[12px] pt-[12px]">
          {vm.isSelf ? (
            <a
              href={editHref}
              className="flex flex-1 items-center justify-center rounded-[12px] bg-kink-gold-bright py-[12px] text-[13px] font-bold text-black"
            >
              {labels.editProfile}
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggleFollow}
                disabled={followBusy}
                aria-pressed={vm.isFollowing}
                className={`flex flex-1 items-center justify-center gap-[8px] rounded-[12px] py-[12px] text-[13px] font-bold shadow transition-opacity hover:opacity-95 disabled:opacity-60 ${
                  vm.isFollowing
                    ? "border border-neutral-800 bg-[#0c0f17] text-white"
                    : "bg-kink-gold-bright text-black"
                }`}
              >
                <MaskIcon name={vm.isFollowing ? "user-check" : "person-add"} width={14} />
                {vm.isFollowing ? (vm.isFriend ? "Friends" : labels.following) : labels.follow}
              </button>

              <a
                href={messageHref}
                className="flex flex-1 items-center justify-center gap-[8px] rounded-[12px] border border-[#1f2937] bg-[#1f2937] py-[12px] text-[13px] font-bold text-[#f9fafb]"
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
                  className="grid size-[42px] shrink-0 place-items-center rounded-[12px] border border-neutral-800 bg-[#0c0f17] text-white shadow transition-colors hover:bg-neutral-800"
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
      </div>
    </section>
  );
}
