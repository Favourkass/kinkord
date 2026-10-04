import Link from "next/link";
import { Bell, Home, MessageCircle } from "lucide-react";
import AvatarCircle from "../app/AvatarCircle";
import type { AppNavLabels, AppNavLinks } from "../app/nav";

export interface NotificationTabBarProps {
  links: AppNavLinks;
  labels: AppNavLabels;
  notificationsCount: number;
  messagesCount: number;
  avatarUrl: string | null;
}

/** Member navigation with a live profile photo. */
export default function NotificationTabBar({
  links,
  labels,
  notificationsCount,
  messagesCount,
  avatarUrl,
}: NotificationTabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-app-card-border bg-app-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-[57px] items-center justify-around">
        <Link
          href={links.home}
          aria-label={labels.home}
          className="grid size-11 place-items-center text-app-text"
        >
          <Home size={25} strokeWidth={1.8} />
        </Link>
        <Link
          href={links.chat}
          aria-label={
            messagesCount > 0 ? `${labels.chat}, ${messagesCount} unread messages` : labels.chat
          }
          className="relative grid size-11 place-items-center text-app-text"
        >
          <MessageCircle size={25} strokeWidth={1.8} />
          <UnreadBadge count={messagesCount} />
        </Link>
        <Link
          href={links.notifications}
          aria-label={
            notificationsCount > 0
              ? `${labels.notifications}, ${notificationsCount} unread notifications`
              : labels.notifications
          }
          aria-current="page"
          className="relative grid size-11 place-items-center text-kink-gold-bright"
        >
          <Bell size={24} strokeWidth={1.8} fill="currentColor" />
          <UnreadBadge count={notificationsCount} />
        </Link>
        <Link
          href={links.profile}
          aria-label={labels.profile}
          className="grid size-11 place-items-center"
        >
          <AvatarCircle src={avatarUrl} alt="" size={30} ringClassName="bg-app-card-border" />
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
