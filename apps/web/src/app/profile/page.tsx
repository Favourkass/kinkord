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
  const vm = useOwnProfilePresenter(search.get("tab"));
  // Your handle is resolved from the API first, so nothing loads until it is
  // known — otherwise the first render would fetch the home feed instead.
  const feed = useFeedPresenter({ author: vm.username, ready: Boolean(vm.username) });

  return (
    <ProfileScreen
      {...vm}
      {...getProfilePosts(feed, shell.avatarUrl)}
      viewerAvatarUrl={shell.avatarUrl}
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
