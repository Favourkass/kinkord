import Link from "next/link";
import { Bell, Home, MessageCircle } from "lucide-react";
import type { AppNavLabels, AppNavLinks } from "../app/nav";

export interface NotificationTabBarProps {
  links: AppNavLinks;
  labels: AppNavLabels;
  unread: boolean;
}

/** Navigation geometry and brand mark from the notification reference. */
export default function NotificationTabBar({ links, labels, unread }: NotificationTabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-app-card-border bg-app-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-[57px] items-center justify-around">
        <Link
          href={links.home}
          aria-label={labels.home}
          className="grid size-11 place-items-center text-kink-gold-bright"
        >
          <Home size={25} strokeWidth={1.8} />
        </Link>
        <Link
          href={links.chat}
          aria-label={labels.chat}
          className="grid size-11 place-items-center text-app-text"
        >
          <MessageCircle size={25} strokeWidth={1.8} />
        </Link>
        <Link
          href={links.notifications}
          aria-label={
            unread ? `${labels.notifications}, unread notifications` : labels.notifications
          }
          aria-current="page"
          className="relative grid size-11 place-items-center text-app-text"
        >
          <Bell size={24} strokeWidth={1.8} />
          {unread && (
            <span
              aria-hidden
              className="absolute right-2 top-1.5 size-1.5 rounded-full bg-kink-gold-bright"
            />
          )}
        </Link>
        <Link
          href={links.profile}
          aria-label={labels.profile}
          className="grid size-11 place-items-center"
        >
          <span className="grid size-[25px] place-items-center overflow-hidden rounded-full border border-kink-gold-bright bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element -- local brand mark */}
            <img src="/brand/logo-badge.png" alt="" className="size-8 max-w-none" />
          </span>
        </Link>
      </div>
    </nav>
  );
}
