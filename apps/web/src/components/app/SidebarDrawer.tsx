import Link from "next/link";
import AvatarCircle from "./AvatarCircle";
import MaskIcon from "./MaskIcon";
import type { AppNavLabels, AppNavLinks } from "./nav";

export interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  name: string;
  avatarUrl: string | null;
  membersCount: string;
  links: Pick<AppNavLinks, "members" | "settings">;
  labels: Pick<AppNavLabels, "members" | "settings" | "logout">;
  onLogout: () => void;
}

/**
 * Mobile slide-over (Figma 873:269 dark / 873:233 light): 348px panel with an
 * identity card, the Members row (live count) and, pinned to the bottom,
 * "Settings and Privacy" + "Log Out".
 */
export default function SidebarDrawer({
  open,
  onClose,
  name,
  avatarUrl,
  membersCount,
  links,
  labels,
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
      <div className="absolute inset-y-0 left-0 flex w-[348px] max-w-[88vw] flex-col border-r border-app-drawer-border bg-app-drawer">
        <div className="mx-[18px] mt-[29px] flex h-[51px] items-center gap-[13px] rounded-[15px] border border-drawer-identity-border px-[12px]">
          <AvatarCircle src={avatarUrl} alt="" size={33} ringClassName="bg-kink-gold-bright" />
          <p className="truncate text-[15px] font-bold text-drawer-text">{name}</p>
        </div>
        <Link
          href={links.members}
          onClick={onClose}
          className="ml-[18px] mt-[21px] flex h-[36px] w-[245px] items-center rounded-[12px] bg-app-members pl-[13px] pr-[9px]"
        >
          <MaskIcon name="people" width={16} className="text-app-members-count" />
          <span className="pl-[10px] text-[12px] font-medium text-drawer-text">
            {labels.members}
          </span>
          <span className="ml-auto text-[10px] font-medium text-app-members-count">
            {membersCount}
          </span>
          <MaskIcon
            name="chevron-right-14"
            width={14}
            className="ml-[14px] text-app-members-count"
          />
        </Link>
        <div className="mt-auto pb-[37px]">
          <Link
            href={links.settings}
            onClick={onClose}
            className="ml-[31px] flex h-[36px] w-[245px] items-center rounded-[12px] bg-drawer-settings pl-[16px] pr-[13px]"
          >
            <MaskIcon name="settings" width={16} className="text-app-members-count" />
            <span className="pl-[10px] text-[12px] font-medium text-drawer-text">
              {labels.settings}
            </span>
            <MaskIcon
              name="chevron-right-14"
              width={14}
              className="ml-auto text-app-members-count"
            />
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="ml-[48px] mt-[11px] flex items-center gap-[10px] text-[12px] font-medium text-drawer-text"
          >
            <MaskIcon name="logout" width={16} className="text-[#b8850f]" />
            {labels.logout}
          </button>
        </div>
      </div>
    </div>
  );
}
