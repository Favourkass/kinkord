import { MEMBERS_COPY } from "@/constants/members";
import { Routes } from "@/constants/Routes";

type AppShellDrawerIcon =
  | "members"
  | "saved"
  | "kinkopedia"
  | "verification"
  | "coins"
  | "subscription"
  | "marketplace"
  | "account"
  | "data"
  | "privacy"
  | "security"
  | "content"
  | "safety"
  | "support"
  | "about";

interface AppShellDrawerItemVM {
  key: string;
  label: string;
  href: string;
  icon: AppShellDrawerIcon;
  count?: "members";
  nav?: "members" | "saved" | "settings" | "security" | "verification";
  soon?: boolean;
}

interface AppShellDrawerVM {
  menuLabel: string;
  primary: AppShellDrawerItemVM[];
  settingsLabel: string;
  settingsGroups: Array<{
    label: string;
    items: AppShellDrawerItemVM[];
  }>;
  soonLabel: string;
  viewProfileLabel: string;
  verifiedLabel: string;
}

/** Structurally matches the shell components' AppNavLinks / AppNavLabels contracts. */
export interface AppShellNavVM {
  links: {
    home: string;
    members: string;
    chat: string;
    notifications: string;
    profile: string;
    settings: string;
    saved: string;
  };
  labels: {
    home: string;
    members: string;
    chat: string;
    notifications: string;
    profile: string;
    settings: string;
    saved: string;
    logout: string;
  };
  drawer: AppShellDrawerVM;
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
      saved: Routes.saved,
    },
    labels: { ...MEMBERS_COPY.nav },
    drawer: {
      menuLabel: "Account menu",
      primary: [
        {
          key: "members",
          label: "Members",
          href: Routes.members,
          icon: "members",
          count: "members",
          nav: "members",
        },
        { key: "saved", label: "Saved", href: Routes.saved, icon: "saved", nav: "saved" },
        {
          key: "kinkopedia",
          label: "Kinkopedia",
          href: Routes.kinkopediaInApp,
          icon: "kinkopedia",
          soon: true,
        },
        {
          key: "verification",
          label: "Verification",
          href: Routes.settingsVerification,
          icon: "verification",
          nav: "verification",
        },
        {
          key: "kinkcoins",
          label: "KinkCoins & Payment",
          href: Routes.kinkCoins,
          icon: "coins",
          soon: true,
        },
        {
          key: "subscription",
          label: "Subscription",
          href: Routes.subscription,
          icon: "subscription",
          soon: true,
        },
        {
          key: "marketplace",
          label: "Marketplace",
          href: Routes.marketplace,
          icon: "marketplace",
          soon: true,
        },
      ],
      settingsLabel: "Settings & Privacy",
      settingsGroups: [
        {
          label: "Account",
          items: [
            {
              key: "account-settings",
              label: "Account Settings",
              href: Routes.settings,
              icon: "account",
              nav: "settings",
            },
            {
              key: "your-data",
              label: "Your Data",
              href: Routes.settingsData,
              icon: "data",
              soon: true,
            },
          ],
        },
        {
          label: "Privacy & Security",
          items: [
            { key: "privacy", label: "Privacy", href: Routes.profileEditPrivacy, icon: "privacy" },
            {
              key: "security",
              label: "Security",
              href: Routes.settingsSecurity,
              icon: "security",
              nav: "security",
            },
          ],
        },
        {
          label: "Preference",
          items: [
            {
              key: "content-experience",
              label: "Content & Experience",
              href: Routes.settingsContent,
              icon: "content",
              soon: true,
            },
          ],
        },
        {
          label: "Safety",
          items: [
            {
              key: "community-safety",
              label: "Community & Safety",
              href: Routes.settingsCommunitySafety,
              icon: "safety",
              soon: true,
            },
          ],
        },
        {
          label: "Support",
          items: [
            { key: "help-support", label: "Help & Support", href: Routes.contact, icon: "support" },
            { key: "about", label: "About Kinkord", href: Routes.about, icon: "about" },
          ],
        },
      ],
      soonLabel: "Soon",
      viewProfileLabel: "View profile",
      verifiedLabel: MEMBERS_COPY.profile.about.verified.identity,
    },
  };
}

/** What every post-login screen hands `AppShell`, built from the home presenter + nav. */
export interface ShellSource {
  greeting: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  membersCount: string;
  verified: boolean;
  notificationsUnread?: boolean;
  notificationsCount?: number;
  messagesCount?: number;
  drawerOpen: boolean;
  settingsMenuOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleSettingsMenu: () => void;
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
    verified: home.verified,
    notificationsUnread: home.notificationsUnread,
    notificationsCount: home.notificationsCount,
    messagesCount: home.messagesCount,
    drawerOpen: home.drawerOpen,
    settingsMenuOpen: home.settingsMenuOpen,
    onMenu: home.openDrawer,
    onCloseDrawer: home.closeDrawer,
    onToggleSettingsMenu: home.toggleSettingsMenu,
    onLogout: home.logout,
    links: nav.links,
    labels: nav.labels,
    drawerNavigation: nav.drawer,
  };
}
