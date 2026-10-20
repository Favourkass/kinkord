"use client";

import { useParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import GroupThreadScreen from "@/components/groups/GroupThreadScreen";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useGroupThreadPresenter } from "@/presenters/useGroupThreadPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

export default function GroupThreadPage() {
  const params = useParams<{ slug: string; id: string }>();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useGroupThreadPresenter(params.slug, params.id);

  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={shell.greeting}
      name={shell.name}
      handle={shell.handle}
      avatarUrl={shell.avatarUrl}
      membersCount={shell.membersCount}
      notificationsUnread={shell.notificationsUnread}
      notificationsCount={shell.notificationsCount}
      messagesCount={shell.messagesCount}
      activeNav="groups"
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
      <GroupThreadScreen {...vm} />
    </AppShell>
  );
}
