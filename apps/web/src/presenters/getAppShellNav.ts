import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";

/** Structurally matches the shell components' AppNavLinks / AppNavLabels contracts. */
export interface AppShellNavVM {
  links: {
    home: string;
    members: string;
    chat: string;
    notifications: string;
    profile: string;
    settings: string;
  };
  labels: {
    home: string;
    members: string;
    chat: string;
    notifications: string;
    profile: string;
    settings: string;
    logout: string;
  };
}

/** Display-ready nav (hrefs + copy) for every AppShell screen. */
export function getAppShellNav(): AppShellNavVM {
  return {
    links: {
      home: Routes.appHome,
      members: Routes.members,
      chat: Routes.messages,
      notifications: Routes.notifications,
      profile: Routes.profile,
      settings: Routes.settings,
    },
    labels: { ...MEMBERS_COPY.nav },
  };
}

/** What every post-login screen hands `AppShell`, built from the home presenter + nav. */
export interface ShellSource {
  greeting: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  membersCount: string;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  logout: () => void;
}

export function appShellProps(home: ShellSource, nav: ReturnType<typeof getAppShellNav>) {
  return {
    brand: "KINKORD",
    tagline: "THE WORLD'S KINK COMMUNITY",
    greeting: home.greeting,
    name: home.name,
    handle: home.handle,
    avatarUrl: home.avatarUrl,
    membersCount: home.membersCount,
    drawerOpen: home.drawerOpen,
    onMenu: home.openDrawer,
    onCloseDrawer: home.closeDrawer,
    onLogout: home.logout,
    links: nav.links,
    labels: nav.labels,
  };
}
