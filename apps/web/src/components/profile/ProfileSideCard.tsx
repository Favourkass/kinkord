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
}: ProfileSideCardProps) {
  return (
    <section className="flex flex-col gap-[24px] overflow-hidden rounded-[20px] border border-pf-border bg-pf-surface">
      <div className="relative h-[220px]">
        <div className="h-[140px] w-full overflow-hidden bg-kink-gold-bright">
          {vm.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vm.coverUrl} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="absolute left-[24px] top-[80px] size-[110px]">
          <span aria-hidden className="absolute inset-0 rounded-full bg-pf-surface" />
          {vm.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vm.avatarUrl}
              alt={vm.displayName}
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
              aria-label={vm.isFollowing ? labels.following : labels.follow}
              className="absolute left-[75px] top-[75px] grid size-[28px] place-items-center rounded-[14px] bg-kink-gold-bright text-white"
            >
              <MaskIcon name={vm.isFollowing ? "user-check" : "plus"} width={14} />
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
            <button
              type="button"
              onClick={onToggleFollow}
              disabled={followBusy}
              aria-pressed={vm.isFollowing}
              className="flex flex-1 items-center justify-center gap-[8px] rounded-[12px] bg-kink-gold-bright py-[12px] text-[13px] font-bold text-black disabled:opacity-60"
            >
              <MaskIcon name={vm.isFollowing ? "user-check" : "person-add"} width={14} />
              {vm.isFollowing ? labels.following : labels.follow}
            </button>
          )}
          <a
            href={messageHref}
            className="flex flex-1 items-center justify-center gap-[8px] rounded-[12px] border border-[#1f2937] bg-[#1f2937] py-[12px] text-[13px] font-bold text-[#f9fafb]"
          >
            <MaskIcon name="message" width={16} />
            {labels.message}
          </a>
        </div>
      </div>
    </section>
  );
}
