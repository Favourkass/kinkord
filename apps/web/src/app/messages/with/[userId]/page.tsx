"use client";

import { use } from "react";
import Link from "next/link";
import AppShell from "@/components/app/AppShell";
import { CHAT_COPY } from "@/constants/chat";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useStartChatPresenter } from "@/presenters/useStartChatPresenter";

/** Where a profile's Message button lands: opens the thread, then moves on. */
export default function StartChatPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const shell = useHomePresenter();
  const start = useStartChatPresenter(decodeURIComponent(userId));
  const nav = getAppShellNav();

  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={shell.greeting}
      name={shell.name}
      handle={shell.handle}
      avatarUrl={shell.avatarUrl}
      membersCount={shell.membersCount}
      activeTab="chat"
      activeNav="chat"
      drawerOpen={shell.drawerOpen}
      onMenu={shell.openDrawer}
      onCloseDrawer={shell.closeDrawer}
      onLogout={shell.logout}
      links={nav.links}
      labels={nav.labels}
    >
      <div className="px-[20px] py-[48px] text-center">
        {start.error ? (
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
