import Image from "next/image";
import Link from "next/link";
import { Bell, House, LogOut, MessageSquare, Settings, User, Users } from "lucide-react";
import type { AppNav, AppNavLabels, AppNavLinks } from "./nav";

export interface DesktopSidebarProps {
  tagline: string;
  active: AppNav;
  links: AppNavLinks;
  labels: AppNavLabels;
  onLogout: () => void;
}

/** Persistent desktop sidebar: horned wordmark, tagline, primary nav, settings, log out. */
export default function DesktopSidebar({
  tagline,
  active,
  links,
  labels,
  onLogout,
}: DesktopSidebarProps) {
  const isActive = (key: AppNav) =>
    active === key || (key === "profile" && active === "edit-profile");
  const item = (key: AppNav) =>
    `mx-[24px] flex items-center gap-[18px] rounded-[14px] px-[20px] py-[12px] text-[20px] font-medium ${
      isActive(key)
        ? "bg-app-members text-kink-amber"
        : "text-app-text opacity-85 hover:opacity-100"
    }`;
  const primary: Array<{ key: Exclude<AppNav, "settings" | "edit-profile">; Icon: typeof House }> =
    [
      { key: "home", Icon: House },
      { key: "members", Icon: Users },
      { key: "chat", Icon: MessageSquare },
      { key: "notifications", Icon: Bell },
      { key: "profile", Icon: User },
    ];
  return (
    <aside className="flex w-[340px] shrink-0 flex-col bg-app-page pb-10">
      <div className="pl-[49px] pt-[23px]">
        <div className="relative h-[70px] w-[265px]">
          <Image
            src="/app/wordmark-light.png"
            alt="Kinkord"
            fill
            priority
            sizes="265px"
            className="object-contain dark:hidden"
          />
          <Image
            src="/app/wordmark-dark.png"
            alt="Kinkord"
            fill
            priority
            sizes="265px"
            className="hidden object-contain dark:block"
          />
        </div>
        <p className="pl-[24px] pt-[2px] text-[11px] font-semibold tracking-[2px] text-app-text">
          {tagline}
        </p>
      </div>
      <div className="ml-[24px] mt-[20px] w-[292px] border-t border-kink-amber/60" />
      <nav className="mt-[22px] flex flex-col gap-[6px]">
        {primary.map(({ key, Icon }) => (
          <Link
            key={key}
            href={links[key]}
            aria-current={isActive(key) ? "page" : undefined}
            className={item(key)}
          >
            <Icon size={26} strokeWidth={1.75} aria-hidden />
            {labels[key]}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-[6px]">
        <Link
          href={links.settings}
          aria-current={active === "settings" ? "page" : undefined}
          className={item("settings")}
        >
          <Settings size={26} strokeWidth={1.75} aria-hidden />
          {labels.settings}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="mx-[24px] flex items-center gap-[18px] rounded-[14px] px-[20px] py-[12px] text-left text-[20px] font-medium text-app-logout-text"
        >
          <LogOut size={26} strokeWidth={1.75} className="text-app-logout-icon" aria-hidden />
          {labels.logout}
        </button>
      </div>
    </aside>
  );
}
