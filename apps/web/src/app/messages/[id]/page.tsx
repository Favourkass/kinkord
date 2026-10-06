"use client";

import { use } from "react";
import AppShell from "@/components/app/AppShell";
import ThreadScreen from "@/components/chat/ThreadScreen";
import { CHAT_COPY } from "@/constants/chat";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useChatThreadPresenter } from "@/presenters/useChatThreadPresenter";

/** Mirrors the API's limit, so the field stops where the server would refuse. */
const MESSAGE_BODY_MAX = 4000;

export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    shell,
    thread,
    composerPhoto,
    safety,
    backHref,
    send,
    retry,
    loadMore,
    attachPhoto,
    removePhoto,
    photoLocked,
    revealPhoto,
    openPhoto,
    closePhoto,
  } = useChatThreadPresenter(id);
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
      notificationsCount={shell.notificationsCount}
      messagesCount={shell.messagesCount}
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
      <ThreadScreen
        peer={thread.peer}
        messages={thread.messages}
        loading={thread.loading}
        error={thread.error}
        sendError={thread.sendError}
        unavailable={thread.unavailable}
        unavailableText={CHAT_COPY.unavailable}
        newChat={thread.newChat}
        onlineLabel={CHAT_COPY.online}
        backHref={backHref}
        backLabel={CHAT_COPY.back}
        emptyText={CHAT_COPY.threadEmpty}
        retryLabel={CHAT_COPY.retry}
        onSend={send}
        onRetry={retry}
        composer={{
          placeholder: CHAT_COPY.placeholder,
          sendLabel: CHAT_COPY.send,
          maxLength: MESSAGE_BODY_MAX,
          photo: {
            ...composerPhoto,
            addLabel: CHAT_COPY.photoAdd,
            removeLabel: CHAT_COPY.photoRemove,
            uploadingLabel: CHAT_COPY.photoUploading,
            onPick: attachPhoto,
            onRemove: removePhoto,
            onLocked: photoLocked,
          },
        }}
        photoNotice={thread.photoNotice}
        photoLabels={{
          alt: CHAT_COPY.photoAlt,
          reveal: CHAT_COPY.photoReveal,
          open: CHAT_COPY.photoOpen,
        }}
        onRevealPhoto={revealPhoto}
        onOpenPhoto={openPhoto}
        viewingPhoto={thread.viewingPhoto}
        photoCloseLabel={CHAT_COPY.photoClose}
        onClosePhoto={closePhoto}
        hasMore={thread.hasMore}
        loadingMore={thread.loadingMore}
        loadMoreLabel={CHAT_COPY.loadMore}
        onLoadMore={loadMore}
        menu={safety.menu}
        blocked={safety.blocked}
        blockDialog={safety.blockDialog}
        report={safety.report}
        safetyError={safety.error}
      />
    </AppShell>
  );
}
