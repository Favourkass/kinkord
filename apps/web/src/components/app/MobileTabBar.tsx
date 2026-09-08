import Link from "next/link";
import { Bell, House, MessageSquare } from "lucide-react";
import AvatarCircle from "./AvatarCircle";
import type { AppNavLabels, AppNavLinks, AppTab } from "./nav";

export type { AppTab } from "./nav";

export interface MobileTabBarProps {
  /** Undefined when the current screen isn't one of the tabs (e.g. Settings). */
  active?: AppTab;
  avatarUrl: string | null;
  links: Pick<AppNavLinks, "home" | "chat" | "notifications" | "profile">;
  labels: Pick<AppNavLabels, "home" | "chat" | "notifications" | "profile">;
}

/** Bottom tab bar: Home, Chat, Notifications, Profile (live avatar). */
export default function MobileTabBar({ active, avatarUrl, links, labels }: MobileTabBarProps) {
  const tone = (tab: AppTab) => (active === tab ? "text-kink-amber" : "text-app-text opacity-80");
  const label = (tab: AppTab) => `text-[12px] font-medium ${tone(tab)}`;
  const tab = (key: Exclude<AppTab, "profile">, Icon: typeof House) => (
    <Link
      href={links[key]}
      aria-current={active === key ? "page" : undefined}
      className="flex flex-col items-center gap-[6px]"
    >
      <Icon size={28} strokeWidth={1.75} className={tone(key)} aria-hidden />
      <span className={label(key)}>{labels[key]}</span>
    </Link>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-app-line bg-app-surface pb-[max(16px,env(safe-area-inset-bottom))] pt-[12px]">
      <div className="grid grid-cols-4 items-end">
        {tab("home", House)}
        {tab("chat", MessageSquare)}
        {tab("notifications", Bell)}
        <Link
          href={links.profile}
          aria-current={active === "profile" ? "page" : undefined}
          className="flex flex-col items-center gap-[4px]"
        >
          <AvatarCircle
            src={avatarUrl}
            alt={labels.profile}
            size={32}
            ringClassName={active === "profile" ? "bg-kink-amber" : undefined}
          />
          <span className={label("profile")}>{labels.profile}</span>
        </Link>
      </div>
    </nav>
  );
}
