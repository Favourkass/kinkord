"use client";

import { useParams, useSearchParams } from "next/navigation";
import ProfileScreen from "@/components/profile/ProfileScreen";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useMemberProfilePresenter } from "@/presenters/useMemberProfilePresenter";

/** Another member's profile (Figma 1202:242 / 1502:2854): Follow + Message (+ inert Gift). */
export default function MemberProfilePage() {
  const params = useParams<{ username: string }>();
  const search = useSearchParams();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useMemberProfilePresenter(params.username, search.get("tab"));

  return (
    <ProfileScreen
      {...vm}
      viewerAvatarUrl={shell.avatarUrl}
      links={nav.links}
      labels={nav.labels}
    />
  );
}
