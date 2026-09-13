import Link from "next/link";
import MaskIcon from "@/components/app/MaskIcon";
import type { PublicProfileVM } from "@/domain/member";

export interface ProfileHeroLabels {
  follow: string;
  following: string;
  message: string;
  yourself: string;
  editProfile: string;
  /** Own profile (Figma 1167:552); inert until stories ship. */
  addToStory: string;
  /** "Gift is not working for now" (CEO) — shown, never active. */
  gift: string;
  comingSoon: string;
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
}

/**
 * Figma profile header (1167:552 own / 1202:242 member): 169px cover, 110px avatar
 * overlay, italic "Last seen", centred name · @handle, bold stats row, pin + location,
 * "25F · Dominant | Sadist", then the action row — own: gold "Add to story" + black
 * "Edit profile"; member: gold Follow + black Message + inert Gift.
 */
export default function ProfileHero({
  vm,
  presenceText,
  labels,
  messageHref,
  editHref,
  onToggleFollow,
  followBusy,
}: ProfileHeroProps) {
  return (
    <section>
      <div className="relative h-[240px]">
        <div className="h-[180px] w-full overflow-hidden bg-kink-gold-bright">
          {vm.coverUrl && (
            // Presigned S3 URL — next/image would need a remote pattern per bucket.
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
        <div className="absolute left-[20px] top-[114px] size-[110px]">
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
        </div>
        {presenceText && (
          <p className="absolute right-[16px] top-[188px] text-[12px] italic leading-[15px] text-pf-muted">
            {presenceText}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-[10px] px-[16px] pb-[16px]">
        <p className="flex items-baseline gap-[6px]">
          <span className="text-[22px] font-bold leading-[27px] text-pf-text">
            {vm.displayName}
          </span>
          {vm.handle && (
            <span className="text-[16px] leading-[19px] text-pf-muted">· {vm.handle}</span>
          )}
        </p>
        <p className="flex items-center gap-[12px] text-[13px] font-bold leading-[16px] text-pf-muted">
          <span>
            {vm.stats.friends} {labels.stats.friends}
          </span>
          <span aria-hidden>·</span>
          <span>
            {vm.stats.followers} {labels.stats.followers}
          </span>
          <span aria-hidden>·</span>
          <span>
            {vm.stats.following} {labels.stats.following}
          </span>
        </p>
        {vm.locationLine && (
          <p className="flex items-center gap-[4px] text-[13px] font-bold leading-[16px] text-pf-muted">
            <MaskIcon name="map-pin" width={14} className="text-kink-gold-bright" />
            {vm.locationLine}
          </p>
        )}
        {vm.tagLine && (
          <p className="text-[14px] font-semibold leading-[17px] text-pf-muted">{vm.tagLine}</p>
        )}
        {vm.isSelf && <p className="text-[12px] text-pf-muted">{labels.yourself}</p>}
      </div>

      <div className="flex gap-[12px] px-[16px] pb-[20px]">
        {vm.isSelf ? (
          <>
            <button
              type="button"
              aria-disabled="true"
              title={labels.comingSoon}
              className="flex h-[36px] flex-1 cursor-default items-center justify-center rounded-[12px] bg-kink-gold-bright text-[11px] font-bold text-white"
            >
              {labels.addToStory}
            </button>
            <Link
              href={editHref}
              className="flex h-[36px] flex-1 items-center justify-center gap-[8px] rounded-[12px] bg-pf-btn-dark text-[11px] font-bold text-white"
            >
              <MaskIcon src="/app/profile/icon-edit-filled.svg" width={16} />
              {labels.editProfile}
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleFollow}
              disabled={followBusy}
              aria-pressed={vm.isFollowing}
              className="flex h-[36px] flex-1 items-center justify-center gap-[8px] rounded-[12px] bg-kink-gold-bright text-[11px] font-bold text-white disabled:opacity-60"
            >
              <MaskIcon name={vm.isFollowing ? "user-check" : "person-add"} width={16} />
              {vm.isFollowing ? labels.following : labels.follow}
            </button>
            <Link
              href={messageHref}
              className="flex h-[36px] flex-1 items-center justify-center gap-[8px] rounded-[12px] bg-pf-btn-dark text-[11px] font-bold text-white"
            >
              <MaskIcon name="message" width={16} />
              {labels.message}
            </Link>
            <button
              type="button"
              disabled
              title={labels.comingSoon}
              className="flex h-[36px] w-[64px] items-center justify-center rounded-[12px] border border-pf-border bg-pf-surface-2 text-[11px] font-bold text-pf-muted"
            >
              {labels.gift}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
