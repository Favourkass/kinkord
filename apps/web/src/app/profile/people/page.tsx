"use client";

import { useSearchParams } from "next/navigation";
import PeopleView from "@/components/profile/PeopleView";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { usePeoplePresenter } from "@/presenters/usePeoplePresenter";
import { useProfilePresenter } from "@/presenters/useProfilePresenter";

function OwnPeopleView({ username }: { username: string }) {
  const search = useSearchParams();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = usePeoplePresenter(username, search.get("tab"));
  return (
    <PeopleView
      {...vm}
      viewerAvatarUrl={shell.avatarUrl}
      links={nav.links}
      tabBarLabels={nav.labels}
    />
  );
}

export default function ProfilePeoplePage() {
  const p = useProfilePresenter();

  if (p.loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-black">
        <p className="text-[14px] text-neutral-400">Loading your profile…</p>
      </div>
    );
  }

  if (!p.me?.username) {
    return (
      <div className="grid min-h-dvh place-items-center bg-black">
        <p className="text-[14px] text-red-400">{p.error ?? "Could not load profile."}</p>
      </div>
    );
  }

  return <OwnPeopleView username={p.me.username} />;
}
