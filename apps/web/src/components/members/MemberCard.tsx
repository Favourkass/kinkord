import Link from "next/link";
import MaskIcon from "@/components/app/MaskIcon";
import type { MemberCardVM } from "@/domain/member";

export interface MemberCardLabels {
  follow: string;
  following: string;
  posts: string;
  followers: string;
  openProfile: string;
}

export interface MemberCardProps {
  vm: MemberCardVM;
  href: string;
  labels: MemberCardLabels;
  onToggleFollow: () => void;
  busy?: boolean;
}

/**
 * Figma 907:1410 (mobile) / 907:1624 (PC) member card: photo, name, "19F • Submissive",
 * pin + location, posts • followers, and an outlined gold Follow pill.
 * The whole card opens the profile via a stretched link; Follow sits above it.
 */
export default function MemberCard({ vm, href, labels, onToggleFollow, busy }: MemberCardProps) {
  return (
    <article className="relative flex h-[75px] items-start rounded-[9px] border border-mem-list-border bg-mem-list-card pl-[12px] pr-[9px] pt-[7px] lg:h-[118px] lg:pl-[10px] lg:pr-[56px] lg:pt-[6px]">
      <span className="relative block h-[61px] w-[81px] shrink-0 overflow-hidden rounded-[9px] border border-[#35332e] bg-[#1c1b18] lg:h-[106px] lg:w-[139px]">
        {vm.avatarUrl ? (
          // Presigned S3 URL — next/image would need a remote pattern per bucket.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vm.avatarUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-[#97917f]">
            <MaskIcon name="people" width={22} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1 pl-[10px] lg:pl-[26px] lg:pt-[7px]">
        <Link
          href={href}
          aria-label={labels.openProfile}
          className="block truncate text-[13px] font-semibold leading-[16px] text-mem-list-text after:absolute after:inset-0 after:content-[''] lg:text-[20px] lg:leading-[24px]"
        >
          {vm.title}
        </Link>
        <p className="flex items-center pt-[4px] text-[10px] font-medium leading-[12px] text-mem-list-muted lg:pt-[8px] lg:text-[16px] lg:leading-[19px]">
          {vm.ageTag && <span>{vm.ageTag}</span>}
          {vm.ageTag && vm.roles && (
            <span
              aria-hidden
              className="mx-[5px] size-[2px] rounded-full bg-mem-dot lg:mx-[10px] lg:size-[4px]"
            />
          )}
          {vm.roles && <span className="truncate">{vm.roles}</span>}
        </p>
        <p className="flex items-center pt-[3px] text-[10px] font-medium leading-[12px] text-mem-list-muted lg:pt-[8px] lg:text-[16px] lg:leading-[19px]">
          <span className="shrink-0 text-mem-list-muted">
            <span className="lg:hidden">
              <MaskIcon name="pin-small" width={10} />
            </span>
            <span className="hidden lg:block">
              <MaskIcon name="pin-small" width={15} />
            </span>
          </span>
          <span className="truncate pl-[3px] lg:pl-[6px]">{vm.location ?? ""}</span>
        </p>
        <p className="flex items-center pt-[2px] text-[10px] leading-[12px] text-mem-list-muted lg:pt-[7px] lg:text-[16px] lg:leading-[19px]">
          <span className="font-semibold text-mem-list-text">{vm.posts}</span>
          <span className="pl-[3px] font-medium">{labels.posts}</span>
          <span
            aria-hidden
            className="mx-[6px] size-[2px] rounded-full bg-kink-gold-bright lg:mx-[10px] lg:size-[4px]"
          />
          <span className="font-semibold text-mem-list-text">{vm.followers}</span>
          <span className="pl-[3px] font-medium">{labels.followers}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onToggleFollow}
        disabled={busy}
        aria-pressed={vm.isFollowing}
        className={`relative z-10 mt-[16px] h-[29px] w-[71px] shrink-0 rounded-[100px] border border-kink-gold-bright text-[12px] font-semibold disabled:opacity-60 lg:mt-[30px] lg:h-[45px] lg:w-[119px] lg:text-[24px] ${
          vm.isFollowing ? "bg-kink-gold-bright text-black" : "text-kink-gold-bright"
        }`}
      >
        {vm.isFollowing ? labels.following : labels.follow}
      </button>
    </article>
  );
}
