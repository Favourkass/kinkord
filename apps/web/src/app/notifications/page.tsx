"use client";

import AppShell from "@/components/app/AppShell";
import ComingSoonPanel from "@/components/app/ComingSoonPanel";
import { MEMBERS_COPY } from "@/constants/members";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";

export default function NotificationsPage() {
  const vm = useHomePresenter();
  const nav = getAppShellNav();
  const copy = MEMBERS_COPY.notifications;

  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={vm.greeting}
      name={vm.name}
      handle={vm.handle}
      avatarUrl={vm.avatarUrl}
      membersCount={vm.membersCount}
      activeTab="notifications"
      activeNav="notifications"
      drawerOpen={vm.drawerOpen}
      onMenu={vm.openDrawer}
      onCloseDrawer={vm.closeDrawer}
      onLogout={vm.logout}
      links={nav.links}
      labels={nav.labels}
    >
      <ComingSoonPanel
        headline={copy.headline}
        constructionLead={copy.constructionLead}
        constructionAccent={copy.constructionAccent}
        subcopy={copy.subcopy}
      />
    </AppShell>
  );
}
