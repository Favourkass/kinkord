import Link from "next/link";
import { MapPin } from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { MemberCardVM } from "@/domain/member";
import PresenceDot from "./PresenceDot";

export interface KinksterCardLabels {
  follow: string;
  following: string;
  posts: string;
  followers: string;
  online: string;
  offline: string;
  openProfile: string;
}

export interface KinksterCardProps {
  vm: MemberCardVM;
  href: string;
  labels: KinksterCardLabels;
  onToggleFollow: () => void;
  busy?: boolean;
}

/**
 * Compact horizontal member card (CEO brief): photo, username + presence dot,
 * "25F • Female", region, posts • followers, and an independent Follow button.
 * The whole card opens the profile via a stretched link; Follow sits above it.
 */
export default function KinksterCard({
  vm,
  href,
  labels,
  onToggleFollow,
  busy,
}: KinksterCardProps) {
  return (
    <article className="relative flex items-center gap-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[12px]">
      <AvatarCircle src={vm.avatarUrl} alt="" size={60} ringClassName="bg-kink-amber" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[6px]">
          <Link
            href={href}
            aria-label={labels.openProfile}
            className="truncate text-[16px] font-bold text-app-text after:absolute after:inset-0 after:content-['']"
          >
            {vm.title}
          </Link>
          <PresenceDot online={vm.isOnline} label={vm.isOnline ? labels.online : labels.offline} />
        </div>
        {vm.meta && <p className="truncate text-[13px] text-app-subtle">{vm.meta}</p>}
        {vm.location && (
          <p className="flex items-center gap-[4px] truncate text-[13px] text-app-subtle">
            <MapPin size={12} className="shrink-0 text-kink-amber" aria-hidden />
            <span className="truncate">{vm.location}</span>
          </p>
        )}
        <p className="truncate text-[12px] text-app-muted">
          {vm.posts} {labels.posts} • {vm.followers} {labels.followers}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggleFollow}
        disabled={busy}
        aria-pressed={vm.isFollowing}
        className={`relative z-10 h-[34px] shrink-0 rounded-full px-[14px] text-[13px] font-bold disabled:opacity-60 ${
          vm.isFollowing ? "border border-kink-amber text-kink-amber" : "bg-kink-amber text-black"
        }`}
      >
        {vm.isFollowing ? labels.following : labels.follow}
      </button>
    </article>
  );
}
