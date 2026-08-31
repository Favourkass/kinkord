"use client";

import AppShell from "@/components/app/AppShell";
import ComingSoonPanel from "@/components/app/ComingSoonPanel";
import { Routes } from "@/constants/Routes";
import { useHomePresenter } from "@/presenters/useHomePresenter";

export default function MessagesPage() {
  const vm = useHomePresenter();

  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={vm.greeting}
      name={vm.name}
      handle={vm.handle}
      avatarUrl={vm.avatarUrl}
      membersCount={vm.membersCount}
      activeTab="messages"
      activeNav="home"
      drawerOpen={vm.drawerOpen}
      onMenu={vm.openDrawer}
      onCloseDrawer={vm.closeDrawer}
      onLogout={vm.logout}
      messagesHref={Routes.messages}
      profileHref={Routes.profile}
      settingsHref={Routes.settings}
    >
      <ComingSoonPanel
        headline="COMING SOON"
        constructionLead="Messages are under"
        constructionAccent="construction"
        subcopy="Private, consent-first conversations are on the way."
      />
    </AppShell>
  );
}
