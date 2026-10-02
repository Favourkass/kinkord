"use client";

import PostListScreen from "@/components/feed/PostListScreen";
import { FEED_COPY } from "@/constants/feed";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { getPostList } from "@/presenters/getPostList";
import { useFeedPresenter } from "@/presenters/useFeedPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** The posts this member saved, newest save first. Private to them. */
export default function SavedPage() {
  const home = useHomePresenter();
  const nav = getAppShellNav();
  const feed = useFeedPresenter({ saved: true });

  return (
    <PostListScreen
      shell={{
        brand: "KINKORD",
        greeting: home.greeting,
        name: home.name,
        avatarUrl: home.avatarUrl,
        membersCount: home.membersCount,
        kycVerified: home.kycVerified,
        notificationsUnread: home.notificationsUnread,
        notificationsCount: home.notificationsCount,
        messagesCount: home.messagesCount,
        drawerOpen: home.drawerOpen,
        settingsMenuOpen: home.settingsMenuOpen,
        onMenu: home.openDrawer,
        onCloseDrawer: home.closeDrawer,
        onToggleSettingsMenu: home.toggleSettingsMenu,
        onLogout: home.logout,
        links: nav.links,
        labels: nav.labels,
        drawerNavigation: nav.drawer,
      }}
      heading={FEED_COPY.savedHeading}
      {...getPostList(feed, home.avatarUrl)}
      copy={{
        empty: FEED_COPY.savedEmpty,
        loading: FEED_COPY.loading,
        loadMore: FEED_COPY.loadMore,
      }}
    />
  );
}
