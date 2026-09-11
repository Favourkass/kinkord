"use client";

import { useParams, useSearchParams } from "next/navigation";
import PeopleView from "@/components/profile/PeopleView";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { usePeoplePresenter } from "@/presenters/usePeoplePresenter";

export default function MemberPeoplePage() {
  const params = useParams<{ username: string }>();
  const search = useSearchParams();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = usePeoplePresenter(params.username, search.get("tab"));

  return (
    <PeopleView
      {...vm}
      viewerAvatarUrl={shell.avatarUrl}
      links={nav.links}
      tabBarLabels={nav.labels}
    />
  );
}
