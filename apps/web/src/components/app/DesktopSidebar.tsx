import Image from "next/image";
import Link from "next/link";
import { LogoutIcon, SettingsIcon, UserIcon } from "./icons";

export interface DesktopSidebarProps {
  tagline: string;
  active: "home" | "profile" | "settings" | "edit-profile";
  profileHref: string;
  settingsHref: string;
  onLogout: () => void;
}

/** Persistent desktop sidebar: horned wordmark, tagline, nav, log out. */
export default function DesktopSidebar({
  tagline,
  active,
  profileHref,
  settingsHref,
  onLogout,
}: DesktopSidebarProps) {
  const item = (isActive: boolean) =>
    `flex items-center gap-[34px] pl-[53px] text-[36px] font-medium text-app-text ${
      isActive ? "" : "opacity-85 hover:opacity-100"
    }`;
  const onEditScreen = active === "edit-profile";
  return (
    <aside className="flex w-[385px] shrink-0 flex-col bg-app-page pb-10">
      <div className="pl-[49px] pt-[23px]">
        <div className="relative h-[83px] w-[315px]">
          <Image
            src="/app/wordmark-light.png"
            alt="Kinkord"
            fill
            priority
            sizes="315px"
            className="object-contain dark:hidden"
          />
          <Image
            src="/app/wordmark-dark.png"
            alt="Kinkord"
            fill
            priority
            sizes="315px"
            className="hidden object-contain dark:block"
          />
        </div>
        <p className="pl-[29px] pt-[2px] text-[12px] font-semibold tracking-[2px] text-app-text">
          {tagline}
        </p>
      </div>
      <div className="ml-[33px] mt-[24px] w-[348px] border-t border-app-line" />
      <nav className="mt-[36px] flex flex-col gap-[35px]">
        <Link href={profileHref} className={item(onEditScreen || active === "profile")}>
          <UserIcon className="text-app-text" />
          {onEditScreen ? "Edit Profile" : "Profile"}
        </Link>
        <Link href={settingsHref} className={item(active === "settings")}>
          <SettingsIcon size={67} className="text-app-text" />
          Settings
        </Link>
      </nav>
      <button
        type="button"
        onClick={onLogout}
        className="mt-auto flex items-center gap-[34px] pl-[53px] text-[36px] font-medium text-app-logout-text"
      >
        <span className="grid size-[67px] place-items-center text-app-logout-icon">
          <LogoutIcon size={54} />
        </span>
        Log Out
      </button>
    </aside>
  );
}
