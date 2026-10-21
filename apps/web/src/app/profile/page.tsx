"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProfileScreen from "@/components/profile/ProfileScreen";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { getProfilePosts } from "@/presenters/getProfilePosts";
import { useFeedPresenter } from "@/presenters/useFeedPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useOwnProfilePresenter } from "@/presenters/useOwnProfilePresenter";

function OwnProfile() {
  const search = useSearchParams();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useOwnProfilePresenter(search.get("tab"), shell.showVerifiedBadge);
  // Your handle is resolved from the API first, so nothing loads until it is
  // known — otherwise the first render would fetch the home feed instead.
  const feed = useFeedPresenter({ author: vm.username, ready: Boolean(vm.username) });
  // The Tagged tab's posts, read while that tab is open.
  const showTagged = vm.tab === "tagged";
  const taggedFeed = useFeedPresenter({
    tagged: vm.username,
    ready: showTagged && Boolean(vm.username),
  });

  return (
    <ProfileScreen
      {...vm}
      {...getProfilePosts(showTagged ? taggedFeed : feed, shell.avatarUrl, null, showTagged)}
      viewerAvatarUrl={shell.avatarUrl}
      notificationsUnread={shell.notificationsUnread}
      notificationsCount={shell.notificationsCount}
      messagesCount={shell.messagesCount}
      links={nav.links}
      labels={nav.labels}
    />
  );
}

/**
 * Your profile (Figma 1167:552 / 1311:769): the designed view with Add to story + Edit profile.
 * /profile is a static route, so the `?tab=` reader needs a Suspense boundary for `next build`.
 */
export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <OwnProfile />
    </Suspense>
  );
}
