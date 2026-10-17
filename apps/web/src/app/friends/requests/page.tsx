"use client";

import AppShell from "@/components/app/AppShell";
import FriendRequests from "@/components/profile/FriendRequests";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useFriendRequestsPresenter } from "@/presenters/useFriendRequestsPresenter";

export default function FriendRequestsPage() {
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useFriendRequestsPresenter(shell.signedIn);

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
      <FriendRequests {...vm} />
    </AppShell>
  );
}
