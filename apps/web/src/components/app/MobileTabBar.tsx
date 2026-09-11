import Link from "next/link";
import AvatarCircle from "./AvatarCircle";
import MaskIcon, { type MaskIconName } from "./MaskIcon";
import type { AppNavLabels, AppNavLinks, AppTab } from "./nav";

import { Routes } from "@/constants/Routes";

export type { AppTab } from "./nav";

export interface MobileTabBarProps {
  /** Undefined when the current screen isn't one of the tabs (e.g. Settings). */
  active?: AppTab;
  avatarUrl?: string | null;
  links?: Pick<AppNavLinks, "home" | "chat" | "notifications" | "profile">;
  labels?: Pick<AppNavLabels, "home" | "chat" | "notifications" | "profile">;
}

const DEFAULT_LINKS: Pick<AppNavLinks, "home" | "chat" | "notifications" | "profile"> = {
  home: Routes.appHome,
  chat: Routes.messages,
  notifications: Routes.notifications,
  profile: Routes.profile,
};

const DEFAULT_LABELS: Pick<AppNavLabels, "home" | "chat" | "notifications" | "profile"> = {
  home: "Home",
  chat: "Chat",
  notifications: "Notifications",
  profile: "Profile",
};

/** Figma tab bar: 57px tall, icon-only; centres at 79/176/265.5/360.5 of a 440px frame. */
const ICON_TABS: Array<{
  key: Exclude<AppTab, "profile">;
  icon: MaskIconName;
  size: number;
  centerPct: number;
}> = [
  { key: "home", icon: "home-solid", size: 24, centerPct: 17.95 },
  { key: "chat", icon: "chat", size: 24, centerPct: 40 },
  { key: "notifications", icon: "bell", size: 21, centerPct: 60.34 },
];
const PROFILE_CENTER_PCT = 81.93;

/** Bottom tab bar: Home, Chat, Notifications, Profile (live avatar) with a 60px gold indicator over the active tab. */
export default function MobileTabBar({
  active,
  avatarUrl = null,
  links = DEFAULT_LINKS,
  labels = DEFAULT_LABELS,
}: MobileTabBarProps) {
  const indicatorCenter =
    active === "profile" ? PROFILE_CENTER_PCT : ICON_TABS.find((t) => t.key === active)?.centerPct;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-mem-hairline bg-mem-header pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative mx-auto h-[57px] max-w-[440px]">
        {indicatorCenter !== undefined && (
          <span
            aria-hidden
            className="absolute top-[-1px] h-[1.5px] w-[60px] -translate-x-1/2 bg-kink-gold-bright"
            style={{ left: `${indicatorCenter}%` }}
          />
        )}
        {ICON_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={links[tab.key]}
            aria-label={labels[tab.key]}
            aria-current={active === tab.key ? "page" : undefined}
            className={`absolute top-[12.5px] grid size-[24px] -translate-x-1/2 place-items-center ${
              active === tab.key ? "text-kink-amber" : "text-mem-tab-icon"
            }`}
            style={{ left: `${tab.centerPct}%` }}
          >
            <MaskIcon name={tab.icon} width={tab.size} />
          </Link>
        ))}
        <Link
          href={links.profile}
          aria-label={labels.profile}
          aria-current={active === "profile" ? "page" : undefined}
          className="absolute top-[12.5px] -translate-x-1/2"
          style={{ left: `${PROFILE_CENTER_PCT}%` }}
        >
          <AvatarCircle src={avatarUrl} alt="" size={21} ringClassName="bg-kink-gold-bright" />
        </Link>
      </div>
    </nav>
  );
}
