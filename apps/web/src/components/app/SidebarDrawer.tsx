import Image from "next/image";
import AvatarCircle from "./AvatarCircle";
import { ChevronRightIcon, LogoutIcon, PeopleIcon } from "./icons";

export interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  name: string;
  handle: string;
  avatarUrl: string | null;
  membersLabel: string;
  membersCount: string;
  logoutLabel: string;
  onLogout: () => void;
}

/** Mobile slide-over: gold banner, avatar, identity, members count, log out. */
export default function SidebarDrawer({
  open,
  onClose,
  name,
  handle,
  avatarUrl,
  membersLabel,
  membersCount,
  logoutLabel,
  onLogout,
}: SidebarDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-y-0 left-0 w-[348px] max-w-[88vw] overflow-y-auto border-r border-app-drawer-border bg-app-drawer">
        <div className="relative mx-[18px] mt-[29px]">
          <div className="relative h-[84px] overflow-hidden rounded-[16px]">
            <Image
              src="/app/gold-metallic.png"
              alt=""
              fill
              sizes="311px"
              className="object-cover"
            />
          </div>
          <div className="absolute left-1/2 top-[20px] -translate-x-1/2">
            <AvatarCircle
              src={avatarUrl}
              alt={name}
              size={117}
              ringClassName="bg-kink-gold-bright"
            />
          </div>
        </div>
        <p className="mt-[66px] text-center text-[32px] font-bold text-app-name">{name}</p>
        <p className="text-center text-[13px] font-light tracking-[2px] text-app-handle">
          {handle}
        </p>
        <div className="mx-[18px] mt-[24px] flex h-[52px] items-center rounded-[16px] bg-app-members pl-[18px] pr-[15px]">
          <PeopleIcon className="text-app-people-icon" />
          <span className="pl-[24px] text-[18px] font-medium text-app-name">{membersLabel}</span>
          <span className="ml-auto text-[14px] font-medium text-app-members-count">
            {membersCount}
          </span>
          <ChevronRightIcon className="ml-[15px] text-[#b8850f]" />
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="mt-[19px] flex items-center pl-[33px] text-[18px] font-medium text-app-logout-text"
        >
          <LogoutIcon className="text-app-logout-icon" />
          <span className="pl-[27px]">{logoutLabel}</span>
        </button>
      </div>
    </div>
  );
}
