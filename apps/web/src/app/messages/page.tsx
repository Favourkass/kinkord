"use client";

import AppShell from "@/components/app/AppShell";
import ChatListScreen from "@/components/chat/ChatListScreen";
import { CHAT_COPY } from "@/constants/chat";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useChatListPresenter } from "@/presenters/useChatListPresenter";

export default function MessagesPage() {
  const { shell, list } = useChatListPresenter();
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
      <ChatListScreen
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        empty={list.empty}
        heading={CHAT_COPY.heading}
        loadingText={CHAT_COPY.loading}
        emptyTitle={CHAT_COPY.emptyTitle}
        emptyBody={CHAT_COPY.emptyBody}
        onlineLabel={CHAT_COPY.online}
      />
    </AppShell>
  );
}
