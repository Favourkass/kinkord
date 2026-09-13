"use client";

import { useParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import RegionList from "@/components/members/RegionList";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useMembersRegionPresenter } from "@/presenters/useMembersRegionPresenter";

/** /members/ng — everyone in the country; the dropdown narrows to a state (CEO, 2026-09-12). */
export default function MembersCountryPage() {
  const params = useParams<{ country: string }>();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useMembersRegionPresenter(params.country, null);

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
      <RegionList {...vm} />
    </AppShell>
  );
}
