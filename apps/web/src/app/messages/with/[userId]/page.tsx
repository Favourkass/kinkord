"use client";

import { use } from "react";
import Link from "next/link";
import AppShell from "@/components/app/AppShell";
import { CHAT_COPY } from "@/constants/chat";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useStartChatPresenter } from "@/presenters/useStartChatPresenter";
import { BRAND_NAME } from "@/constants/landing";

/** Where a profile's Message button lands: opens the thread, then moves on. */
export default function StartChatPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const shell = useHomePresenter();
  const start = useStartChatPresenter(decodeURIComponent(userId));
  const nav = getAppShellNav();

  return (
    <AppShell
      brand={BRAND_NAME}
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={shell.greeting}
      name={shell.name}
      handle={shell.handle}
      avatarUrl={shell.avatarUrl}
      membersCount={shell.membersCount}
      notificationsUnread={shell.notificationsUnread}
      notificationsCount={shell.notificationsCount}
      messagesCount={shell.messagesCount}
      activeTab="chat"
      activeNav="chat"
      drawerOpen={shell.drawerOpen}
      onMenu={shell.openDrawer}
      onCloseDrawer={shell.closeDrawer}
      onLogout={shell.logout}
      links={nav.links}
      labels={nav.labels}
      drawerNavigation={nav.drawer}
      verificationEntry={shell.verificationEntry}
    >
      <div className="px-[20px] py-[48px] text-center">
        {start.premium ? (
          <>
            <p className="whitespace-pre-line text-[14px] text-app-text">{start.premium.text}</p>
            <Link
              href={start.premium.href}
              className="mt-[16px] inline-block rounded-full bg-kink-gold-bright px-[18px] py-[9px] text-[14px] font-bold text-kink-ink"
            >
              {start.premium.linkLabel}
            </Link>
            <Link
              href={start.backHref}
              className="mt-[12px] block text-[14px] text-app-muted underline"
            >
              {CHAT_COPY.heading}
            </Link>
          </>
        ) : start.error ? (
          <>
            <p className="text-[14px] font-semibold text-app-danger">{start.error}</p>
            <Link
              href={start.backHref}
              className="mt-[12px] inline-block text-[14px] text-app-muted underline"
            >
              {CHAT_COPY.heading}
            </Link>
          </>
        ) : (
          <p className="text-[14px] text-app-muted">{CHAT_COPY.opening}</p>
        )}
      </div>
    </AppShell>
  );
}
