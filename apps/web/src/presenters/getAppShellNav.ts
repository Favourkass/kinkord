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
}

interface AppShellDrawerVM {
  primary: AppShellDrawerItemVM[];
  settingsLabel: string;
  settingsGroups: Array<{
    label: string;
    items: AppShellDrawerItemVM[];
  }>;
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
      primary: [
        {
          key: "members",
          label: "Members",
          href: Routes.members,
          icon: "members",
          count: "members",
        },
        { key: "saved", label: "Saved", href: Routes.saved, icon: "saved" },
        { key: "kinkopedia", label: "Kinkopedia", href: Routes.kinkopedia, icon: "kinkopedia" },
        {
          key: "verification",
          label: "Verification",
          href: Routes.settingsKyc,
          icon: "verification",
        },
        { key: "kinkcoins", label: "KinkCoins & Payment", href: Routes.kinkCoins, icon: "coins" },
        {
          key: "subscription",
          label: "Subscription",
          href: Routes.subscription,
          icon: "subscription",
        },
        { key: "marketplace", label: "Marketplace", href: Routes.marketplace, icon: "marketplace" },
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
            },
            { key: "your-data", label: "Your Data", href: Routes.settingsData, icon: "data" },
          ],
        },
        {
          label: "Privacy & Security",
          items: [
            { key: "privacy", label: "Privacy", href: Routes.profileEditPrivacy, icon: "privacy" },
            { key: "security", label: "Security", href: Routes.settingsSecurity, icon: "security" },
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
  kycVerified: boolean;
  notificationsUnread?: boolean;
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
    kycVerified: home.kycVerified,
    notificationsUnread: home.notificationsUnread,
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
