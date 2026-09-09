"use client";

import { useParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import StateSelect from "@/components/members/StateSelect";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useMembersStatePresenter } from "@/presenters/useMembersStatePresenter";

export default function MembersStatesPage() {
  const params = useParams<{ country: string }>();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useMembersStatePresenter(params.country);

  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={shell.greeting}
      name={shell.name}
      handle={shell.handle}
      avatarUrl={shell.avatarUrl}
      membersCount={shell.membersCount}
      activeTab="home"
      activeNav="members"
      drawerOpen={shell.drawerOpen}
      onMenu={shell.openDrawer}
      onCloseDrawer={shell.closeDrawer}
      onLogout={shell.logout}
      links={nav.links}
      labels={nav.labels}
      mobileTone="members"
      desktopGreeting={false}
    >
      <StateSelect {...vm} />
    </AppShell>
  );
}
