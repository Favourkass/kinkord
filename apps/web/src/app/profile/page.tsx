"use client";

import { useSearchParams } from "next/navigation";
import ProfileScreen from "@/components/profile/ProfileScreen";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useOwnProfilePresenter } from "@/presenters/useOwnProfilePresenter";

/** Your profile (Figma 1167:552 / 1311:769): the designed view with Add to story + Edit profile. */
export default function ProfilePage() {
  const search = useSearchParams();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useOwnProfilePresenter(search.get("tab"));

  return (
    <ProfileScreen
      {...vm}
      viewerAvatarUrl={shell.avatarUrl}
      links={nav.links}
      labels={nav.labels}
    />
  );
}
