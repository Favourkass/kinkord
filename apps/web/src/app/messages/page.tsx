"use client";

import AppShell from "@/components/app/AppShell";
import ChatListScreen from "@/components/chat/ChatListScreen";
import PushPrompt from "@/components/chat/PushPrompt";
import { CHAT_COPY } from "@/constants/chat";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useChatListPresenter } from "@/presenters/useChatListPresenter";
import { usePushPresenter } from "@/presenters/usePushPresenter";

export default function MessagesPage() {
  const { shell, list } = useChatListPresenter();
  const push = usePushPresenter();
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
      verified={shell.verified}
      notificationsUnread={shell.notificationsUnread}
      activeTab="chat"
      activeNav="chat"
      drawerOpen={shell.drawerOpen}
      onMenu={shell.openDrawer}
      onCloseDrawer={shell.closeDrawer}
      settingsMenuOpen={shell.settingsMenuOpen}
      onToggleSettingsMenu={shell.toggleSettingsMenu}
      onLogout={shell.logout}
      links={nav.links}
      labels={nav.labels}
      drawerNavigation={nav.drawer}
    >
      <ChatListScreen
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        empty={list.empty}
        heading={CHAT_COPY.heading}
        banner={push.prompt && <PushPrompt {...push.prompt} />}
        loadingText={CHAT_COPY.loading}
        emptyTitle={CHAT_COPY.emptyTitle}
        emptyBody={CHAT_COPY.emptyBody}
        onlineLabel={CHAT_COPY.online}
      />
    </AppShell>
  );
}
