"use client";

import { useParams } from "next/navigation";
import PostListScreen from "@/components/feed/PostListScreen";
import { FEED_COPY } from "@/constants/feed";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { getPostList } from "@/presenters/getPostList";
import { useFeedPresenter } from "@/presenters/useFeedPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** One post on its own — where a shared link lands. */
export default function PostPage() {
  const params = useParams<{ id: string }>();
  const home = useHomePresenter();
  const nav = getAppShellNav();
  const feed = useFeedPresenter({ postId: params.id });

  return (
    <PostListScreen
      shell={{
        brand: "KINKORD",
        greeting: home.greeting,
        name: home.name,
        avatarUrl: home.avatarUrl,
        membersCount: home.membersCount,
        drawerOpen: home.drawerOpen,
        onMenu: home.openDrawer,
        onCloseDrawer: home.closeDrawer,
        onLogout: home.logout,
        links: nav.links,
        labels: nav.labels,
      }}
      heading={FEED_COPY.postHeading}
      {...getPostList(feed, home.avatarUrl)}
      copy={{
        empty: FEED_COPY.postGone,
        loading: FEED_COPY.loading,
        loadMore: FEED_COPY.loadMore,
      }}
    />
  );
}
