import Link from "next/link";
import AvatarCircle from "./AvatarCircle";
import { MessageIcon, SettingsIcon } from "./icons";

export type AppTab = "messages" | "profile" | "settings";

export interface MobileTabBarProps {
  active: AppTab;
  avatarUrl: string | null;
  messagesHref: string;
  profileHref: string;
  settingsHref: string;
}

/** Bottom tab bar: Messages, Profile (live avatar), Settings. */
export default function MobileTabBar({
  active,
  avatarUrl,
  messagesHref,
  profileHref,
  settingsHref,
}: MobileTabBarProps) {
  const label = (tab: AppTab) =>
    `text-[14px] font-medium text-app-text ${active === tab ? "" : "opacity-80"}`;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-app-line bg-app-surface pb-[20px] pt-[21px]">
      <div className="grid grid-cols-3 items-end">
        <Link href={messagesHref} className="flex flex-col items-center gap-[8px]">
          <MessageIcon className="text-app-text" />
          <span className={label("messages")}>Messages</span>
        </Link>
        <Link href={profileHref} className="flex flex-col items-center gap-[6px]">
          <AvatarCircle src={avatarUrl} alt="Your profile" size={44} />
          <span className={label("profile")}>Profile</span>
        </Link>
        <Link href={settingsHref} className="flex flex-col items-center gap-[8px]">
          <SettingsIcon className="text-app-text" />
          <span className={label("settings")}>Settings</span>
        </Link>
      </div>
    </nav>
  );
}
