"use client";

import AppShell from "@/components/app/AppShell";
import GroupsScreen from "@/components/groups/GroupsScreen";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useGroupsPresenter } from "@/presenters/useGroupsPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

export default function GroupsPage() {
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useGroupsPresenter();

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
      <GroupsScreen {...vm} />
    </AppShell>
  );
}
