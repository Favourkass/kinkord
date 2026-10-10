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
      brand={CHAT_COPY.inbox.brand}
      mobileHeader={<></>}
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
    >
      <ChatListScreen
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        empty={list.empty}
        heading={CHAT_COPY.inbox.brand}
        banner={push.prompt && <PushPrompt {...push.prompt} />}
        loadingText={CHAT_COPY.loading}
        emptyTitle={list.emptyTitle}
        emptyBody={list.emptyBody}
        onlineLabel={CHAT_COPY.online}
        query={list.query}
        onQuery={list.setQuery}
        filters={list.filters}
        onFilter={list.setFilter}
        menuOpen={list.menuOpen}
        onToggleMenu={list.toggleMenu}
        onNavigation={list.openNavigation}
        newChatHref={list.newChatHref}
        settingsHref={list.settingsHref}
        copy={CHAT_COPY.inbox}
      />
    </AppShell>
  );
}
