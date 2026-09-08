import Link from "next/link";
import { MapPin } from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { PublicProfileVM } from "@/domain/member";
import PresenceDot from "./PresenceDot";

export interface ProfileHeaderLabels {
  follow: string;
  following: string;
  message: string;
  online: string;
  offline: string;
  yourself: string;
  editProfile: string;
  stats: { friends: string; followers: string; following: string };
}

export interface ProfileHeaderProps {
  vm: PublicProfileVM;
  /** "Online" or "Last seen an hour ago"; null when never seen. */
  presenceText: string | null;
  labels: ProfileHeaderLabels;
  messageHref: string;
  editHref: string;
  onToggleFollow: () => void;
  followBusy: boolean;
}

/** Public profile hero: cover, avatar + presence, identity, stats, location, tag line, actions. */
export default function ProfileHeader({
  vm,
  presenceText,
  labels,
  messageHref,
  editHref,
  onToggleFollow,
  followBusy,
}: ProfileHeaderProps) {
  const stat = (value: string, label: string) => (
    <div className="flex flex-col items-center">
      <span className="text-[18px] font-bold text-app-text">{value}</span>
      <span className="text-[12px] text-app-muted">{label}</span>
    </div>
  );
  return (
    <section className="mx-auto w-full max-w-[600px]">
      <div className="relative h-[140px] w-full overflow-hidden bg-gradient-to-br from-[#3a2a05] via-[#6b4c0a] to-[#b8850f] lg:rounded-[20px]">
        {vm.coverUrl && (
          // Presigned S3 URL: next/image would need a remote-pattern per bucket, so use the plain element.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vm.coverUrl} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="px-[16px]">
        <div className="-mt-[48px] flex items-end justify-between">
          <div className="relative">
            <AvatarCircle
              src={vm.avatarUrl}
              alt={vm.displayName}
              size={96}
              ringClassName="bg-kink-amber"
            />
            <span className="absolute bottom-[4px] right-[4px] rounded-full bg-app-surface p-[2px]">
              <PresenceDot
                online={vm.isOnline}
                label={vm.isOnline ? labels.online : labels.offline}
                size={14}
              />
            </span>
          </div>
          <div className="flex items-center gap-[8px] pb-[4px]">
            {vm.isSelf ? (
              <Link
                href={editHref}
                className="h-[36px] rounded-full border border-kink-amber px-[16px] text-[14px] font-bold leading-[34px] text-kink-amber"
              >
                {labels.editProfile}
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onToggleFollow}
                  disabled={followBusy}
                  aria-pressed={vm.isFollowing}
                  className={`h-[36px] rounded-full px-[18px] text-[14px] font-bold disabled:opacity-60 ${
                    vm.isFollowing
                      ? "border border-kink-amber text-kink-amber"
                      : "bg-kink-amber text-black"
                  }`}
                >
                  {vm.isFollowing ? labels.following : labels.follow}
                </button>
                <Link
                  href={messageHref}
                  className="h-[36px] rounded-full border border-app-card-border px-[16px] text-[14px] font-bold leading-[34px] text-app-text"
                >
                  {labels.message}
                </Link>
              </>
            )}
          </div>
        </div>

        <h1 className="pt-[10px] text-[22px] font-bold leading-tight text-app-text">
          {vm.displayName}
        </h1>
        {vm.handle && <p className="text-[13px] tracking-[1px] text-app-handle">{vm.handle}</p>}
        {vm.isSelf && <p className="pt-[2px] text-[12px] text-app-muted">{labels.yourself}</p>}
        {presenceText && (
          <p className="flex items-center gap-[6px] pt-[6px] text-[13px] text-app-subtle">
            <PresenceDot
              online={vm.isOnline}
              label={vm.isOnline ? labels.online : labels.offline}
              size={8}
            />
            {presenceText}
          </p>
        )}

        <div className="mt-[14px] grid grid-cols-3 rounded-[14px] border border-app-card-border bg-app-card py-[10px]">
          {stat(vm.stats.friends, labels.stats.friends)}
          {stat(vm.stats.followers, labels.stats.followers)}
          {stat(vm.stats.following, labels.stats.following)}
        </div>

        {vm.locationLine && (
          <p className="flex items-center gap-[6px] pt-[12px] text-[14px] text-app-subtle">
            <MapPin size={14} className="shrink-0 text-kink-amber" aria-hidden />
            {vm.locationLine}
          </p>
        )}
        {vm.tagLine && (
          <p className="pt-[4px] text-[14px] font-semibold text-kink-amber">{vm.tagLine}</p>
        )}
      </div>
    </section>
  );
}
