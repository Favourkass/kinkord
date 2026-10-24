"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AppShell from "@/components/app/AppShell";
import RelationshipsScreen from "@/components/relationships/RelationshipsScreen";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useRelationshipsPresenter } from "@/presenters/useRelationshipsPresenter";
import { BRAND_NAME } from "@/constants/landing";

function Relationships() {
  const search = useSearchParams();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useRelationshipsPresenter(shell.signedIn, search.get("with"));

  return (
    <AppShell
      brand={BRAND_NAME}
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={shell.greeting}
      name={shell.name}
      handle={shell.handle}
      avatarUrl={shell.avatarUrl}
      membersCount={shell.membersCount}
      notificationsUnread={shell.notificationsUnread}
      notificationsCount={shell.notificationsCount}
      messagesCount={shell.messagesCount}
      activeNav="members"
      drawerOpen={shell.drawerOpen}
      onMenu={shell.openDrawer}
      onCloseDrawer={shell.closeDrawer}
      onLogout={shell.logout}
      links={nav.links}
      labels={nav.labels}
      drawerNavigation={nav.drawer}
      verificationEntry={shell.verificationEntry}
      mobileTone="members"
      desktopGreeting={false}
    >
      <RelationshipsScreen {...vm} />
    </AppShell>
  );
}

/** Linked D/s and other relationships: yours, and the requests waiting either way. */
export default function RelationshipsPage() {
  // ?with= is read on the client, so a static build waits for it behind Suspense.
  return (
    <Suspense fallback={null}>
      <Relationships />
    </Suspense>
  );
}
