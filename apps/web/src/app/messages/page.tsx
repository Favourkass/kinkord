"use client";

import AppShell from "@/components/app/AppShell";
import ChatListScreen from "@/components/chat/ChatListScreen";
import PushPrompt from "@/components/chat/PushPrompt";
import { CHAT_COPY, INBOX_SEARCH_MAX } from "@/constants/chat";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useChatListPresenter } from "@/presenters/useChatListPresenter";
import { usePushPresenter } from "@/presenters/usePushPresenter";
import { BRAND_NAME } from "@/constants/landing";

export default function MessagesPage() {
  const { shell, list } = useChatListPresenter();
  const push = usePushPresenter();
  const nav = getAppShellNav();

  return (
    <AppShell
      brand={BRAND_NAME}
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
      drawerNavigation={nav.drawer}
      verificationEntry={shell.verificationEntry}
    >
      <ChatListScreen
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        empty={list.empty}
        heading={CHAT_COPY.heading}
        banner={push.prompt && <PushPrompt {...push.prompt} />}
        loadingText={CHAT_COPY.loading}
        emptyTitle={list.emptyTitle}
        emptyBody={list.emptyBody}
        onlineLabel={CHAT_COPY.online}
        organizationLabel={CHAT_COPY.organization}
        verifiedOrganizationLabel={CHAT_COPY.verifiedOrganization}
        query={list.query}
        onQuery={list.setQuery}
        searchMaxLength={INBOX_SEARCH_MAX}
        filters={list.filters}
        onFilter={list.setFilter}
        menuOpen={list.menuOpen}
        onToggleMenu={list.toggleMenu}
        onCloseMenu={list.closeMenu}
        onNavigation={list.openNavigation}
        newChatHref={list.newChatHref}
        settingsHref={list.settingsHref}
        copy={CHAT_COPY.inbox}
      />
    </AppShell>
  );
}
