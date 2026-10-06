"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import RegionList from "@/components/members/RegionList";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useMembersRegionPresenter } from "@/presenters/useMembersRegionPresenter";

function MembersRegion() {
  const params = useParams<{ country: string; state: string }>();
  const search = useSearchParams();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useMembersRegionPresenter(params.country, params.state, search.get("region"));

  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={shell.greeting}
      name={shell.name}
      handle={shell.handle}
      avatarUrl={shell.avatarUrl}
      membersCount={shell.membersCount}
      verified={shell.verified}
      notificationsUnread={shell.notificationsUnread}
      notificationsCount={shell.notificationsCount}
      messagesCount={shell.messagesCount}
      activeNav="members"
      drawerOpen={shell.drawerOpen}
      onMenu={shell.openDrawer}
      onCloseDrawer={shell.closeDrawer}
      settingsMenuOpen={shell.settingsMenuOpen}
      onToggleSettingsMenu={shell.toggleSettingsMenu}
      onLogout={shell.logout}
      links={nav.links}
      labels={nav.labels}
      drawerNavigation={nav.drawer}
      mobileTone="members"
      desktopGreeting={false}
    >
      <RegionList {...vm} />
    </AppShell>
  );
}

/** Reading `?region=` needs a Suspense boundary for `next build`. */
export default function MembersRegionPage() {
  return (
    <Suspense fallback={null}>
      <MembersRegion />
    </Suspense>
  );
}
