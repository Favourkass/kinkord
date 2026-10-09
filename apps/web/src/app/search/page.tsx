"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SearchScreen from "@/components/search/SearchScreen";
import { isSearchTab } from "@/domain/search";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { getPostList } from "@/presenters/getPostList";
import { useFeedPresenter } from "@/presenters/useFeedPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useSearchPresenter } from "@/presenters/useSearchPresenter";

/** The app's search: people and posts, from the magnifier in every member screen's header. */
function Search() {
  const params = useSearchParams();
  const home = useHomePresenter();
  const nav = getAppShellNav();
  const s = useSearchPresenter(params.get("q"));
  // Posts are the feed's own, so a post found behaves exactly as in the feed.
  const feed = useFeedPresenter({ search: s.term, ready: s.postsReady });
  const { giftDialog, commentsPanel, lightbox, confirm, toast, ...posts } = getPostList(
    feed,
    home.avatarUrl,
  );

  return (
    <SearchScreen
      shell={{
        brand: "Kinkord",
        greeting: home.greeting,
        name: home.name,
        avatarUrl: home.avatarUrl,
        membersCount: home.membersCount,
        notificationsUnread: home.notificationsUnread,
        notificationsCount: home.notificationsCount,
        messagesCount: home.messagesCount,
        drawerOpen: home.drawerOpen,
        onMenu: home.openDrawer,
        onCloseDrawer: home.closeDrawer,
        onLogout: home.logout,
        links: nav.links,
        labels: nav.labels,
      }}
      query={s.query}
      onQuery={s.setQuery}
      onClear={s.clear}
      maxLength={s.maxLength}
      tabs={s.tabs}
      onTab={(key) => {
        if (isSearchTab(key)) s.setTab(key);
      }}
      hint={s.hint}
      people={s.people}
      postsShown={s.postsShown}
      postsHeading={s.postsHeading}
      posts={{
        ...posts,
        copy: { empty: s.postsEmpty, loading: s.labels.searching, loadMore: s.labels.loadMore },
      }}
      giftDialog={giftDialog}
      commentsPanel={commentsPanel}
      lightbox={lightbox}
      confirm={confirm}
      toast={toast}
      labels={s.labels}
    />
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <Search />
    </Suspense>
  );
}
