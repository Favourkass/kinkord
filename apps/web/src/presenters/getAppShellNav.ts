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
