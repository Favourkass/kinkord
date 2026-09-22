"use client";

import { use } from "react";
import AppShell from "@/components/app/AppShell";
import ThreadScreen from "@/components/chat/ThreadScreen";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useChatThreadPresenter } from "@/presenters/useChatThreadPresenter";

export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { shell, thread, send, notifyTyping, loadMore } = useChatThreadPresenter(id);
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
      <ThreadScreen
        peer={thread.peer}
        messages={thread.messages}
        loading={thread.loading}
        error={thread.error}
        typing={thread.typing}
        typingLabel="typing…"
        onlineLabel="Online"
        backHref="/messages"
        backLabel="Back"
        emptyText="Say hi — this is the start of your conversation."
        retryLabel="Retry"
        onSend={send}
        onTyping={notifyTyping}
        composer={{
          placeholder: "Message…",
          sendLabel: "Send",
          maxLength: 4000,
          disabled: !thread.peer,
        }}
        hasMore={thread.hasMore}
        loadingMore={thread.loadingMore}
        loadMoreLabel="Load earlier messages"
        onLoadMore={loadMore}
      />
    </AppShell>
  );
}
