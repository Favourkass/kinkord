import Link from "next/link";
import { Bell, Home, MessageCircle } from "lucide-react";
import AvatarCircle from "./AvatarCircle";
import type { AppNavLabels, AppNavLinks, AppTab } from "./nav";
export type { AppTab } from "./nav";

export interface MobileTabBarProps {
  active?: AppTab;
  links: Pick<AppNavLinks, "home" | "chat" | "notifications" | "profile">;
  labels: Pick<AppNavLabels, "home" | "chat" | "notifications" | "profile">;
  notificationsCount?: number;
  messagesCount?: number;
  avatarUrl: string | null;
}

/** Member navigation with a live profile photo. */
export default function MobileTabBar({
  links,
  labels,
  active,
  notificationsCount = 0,
  messagesCount = 0,
  avatarUrl,
}: MobileTabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-app-card-border bg-app-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-[57px] items-center justify-around">
        <Link
          href={links.home}
          aria-label={labels.home}
          aria-current={active === "home" ? "page" : undefined}
          className={`grid size-11 place-items-center ${active === "home" ? "text-kink-gold-bright" : "text-app-text"}`}
        >
          <Home size={25} strokeWidth={1.8} fill={active === "home" ? "currentColor" : "none"} />
        </Link>
        <Link
          href={links.chat}
          aria-label={
            messagesCount > 0 ? `${labels.chat}, ${messagesCount} unread messages` : labels.chat
          }
          aria-current={active === "chat" ? "page" : undefined}
          className={`relative grid size-11 place-items-center ${active === "chat" ? "text-kink-gold-bright" : "text-app-text"}`}
        >
          <MessageCircle
            size={25}
            strokeWidth={1.8}
            fill={active === "chat" ? "currentColor" : "none"}
          />
          <UnreadBadge count={messagesCount} />
        </Link>
        <Link
          href={links.notifications}
          aria-label={
            notificationsCount > 0
              ? `${labels.notifications}, ${notificationsCount} unread notifications`
              : labels.notifications
          }
          aria-current={active === "notifications" ? "page" : undefined}
          className={`relative grid size-11 place-items-center ${active === "notifications" ? "text-kink-gold-bright" : "text-app-text"}`}
        >
          <Bell
            size={24}
            strokeWidth={1.8}
            fill={active === "notifications" ? "currentColor" : "none"}
          />
          <UnreadBadge count={notificationsCount} />
        </Link>
        <Link
          href={links.profile}
          aria-label={labels.profile}
          aria-current={active === "profile" ? "page" : undefined}
          className="grid size-11 place-items-center"
        >
          <AvatarCircle
            src={avatarUrl}
            alt=""
            size={30}
            ringClassName={active === "profile" ? "bg-kink-gold-bright" : "bg-app-card-border"}
          />
        </Link>
      </div>
    </nav>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute -top-0.5 right-0 grid min-w-[18px] h-[18px] px-1 place-items-center rounded-full bg-kink-gold-bright text-[10px] font-bold leading-none text-black ring-2 ring-app-surface"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
