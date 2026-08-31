"use client";

import AppShell from "@/components/app/AppShell";
import ComingSoonPanel from "@/components/app/ComingSoonPanel";
import { Routes } from "@/constants/Routes";
import { useHomePresenter } from "@/presenters/useHomePresenter";

export default function HomePage() {
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
      activeTab="profile"
      activeNav="home"
      drawerOpen={vm.drawerOpen}
      onMenu={vm.openDrawer}
      onCloseDrawer={vm.closeDrawer}
      onLogout={vm.logout}
      messagesHref={Routes.messages}
      profileHref={Routes.profile}
      settingsHref={Routes.settings}
    >
      {vm.error ? (
        <p className="text-center text-[15px] font-semibold text-app-subtle">{vm.error}</p>
      ) : (
        <ComingSoonPanel
          headline="COMING SOON"
          constructionLead="Kinkord is under"
          constructionAccent="construction"
          subcopy="We're building something extraordinary for the kink community."
        />
      )}
    </AppShell>
  );
}
