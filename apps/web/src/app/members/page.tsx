"use client";

import AppShell from "@/components/app/AppShell";
import CountrySelect from "@/components/members/CountrySelect";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useMembersCountryPresenter } from "@/presenters/useMembersCountryPresenter";

export default function MembersCountryPage() {
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useMembersCountryPresenter();

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
      <CountrySelect {...vm} />
    </AppShell>
  );
}
