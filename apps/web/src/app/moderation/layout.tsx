"use client";

import type { ReactNode } from "react";
import AppShell from "@/components/app/AppShell";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** The normal app chrome around every admin screen; it stays mounted between them. */
export default function ModerationLayout({ children }: { children: ReactNode }) {
  const vm = useHomePresenter();
  const nav = getAppShellNav();
  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={vm.greeting}
      name={vm.name}
      handle={vm.handle}
      avatarUrl={vm.avatarUrl}
      membersCount={vm.membersCount}
      kycVerified={vm.kycVerified}
      notificationsUnread={vm.notificationsUnread}
      activeNav="settings"
      drawerOpen={vm.drawerOpen}
      onMenu={vm.openDrawer}
      onCloseDrawer={vm.closeDrawer}
      settingsMenuOpen={vm.settingsMenuOpen}
      onToggleSettingsMenu={vm.toggleSettingsMenu}
      onLogout={vm.logout}
      links={nav.links}
      labels={nav.labels}
      drawerNavigation={nav.drawer}
    >
      {children}
    </AppShell>
  );
}
