"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import NotificationHeader from "@/components/notifications/NotificationHeader";
import NotificationTabBar from "@/components/notifications/NotificationTabBar";
import NotificationInbox from "@/components/notifications/NotificationInbox";
import { NOTIFICATIONS_COPY } from "@/constants/notifications";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useNotificationsPresenter } from "@/presenters/useNotificationsPresenter";

function NotificationsScreen() {
  const shell = useHomePresenter();
  const search = useSearchParams();
  const inbox = useNotificationsPresenter(shell.signedIn, search.get("open"));
  const nav = getAppShellNav();
  return (
    <AppShell
      {...appShellProps(shell, nav)}
      activeTab="notifications"
      activeNav="notifications"
      desktopGreeting={false}
      mobileHeader={
        <NotificationHeader
          title={NOTIFICATIONS_COPY.title}
          searchLabel={NOTIFICATIONS_COPY.search}
          searchOpen={inbox.searchOpen}
          onMenu={shell.openDrawer}
          onSearch={inbox.toggleSearch}
        />
      }
      mobileFooter={
        <NotificationTabBar
          links={nav.links}
          labels={nav.labels}
          unread={shell.notificationsUnread}
        />
      }
    >
      <NotificationInbox
        {...inbox}
        error={inbox.error ?? shell.error}
        onFilter={inbox.setUnreadOnly}
        onOpen={inbox.openNotification}
        onMarkAll={inbox.markAll}
        onLoadMore={inbox.loadMore}
        onRefresh={inbox.refresh}
        copy={NOTIFICATIONS_COPY}
      />
    </AppShell>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-app-subtle">{NOTIFICATIONS_COPY.loading}</p>}>
      <NotificationsScreen />
    </Suspense>
  );
}
