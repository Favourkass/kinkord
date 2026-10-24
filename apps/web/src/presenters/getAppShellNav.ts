import { BRAND_NAME } from "@/constants/landing";
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
  nav?: "members" | "saved" | "settings" | "kinkcoins";
  soon?: boolean;
  verification?: boolean;
}

/** Structurally matches the drawer's DrawerNavigation contract. */
interface AppShellDrawerVM {
  menuLabel: string;
  primary: AppShellDrawerItemVM[];
  settingsLabel: string;
  settingsGroups: Array<{ label: string; items: AppShellDrawerItemVM[] }>;
  soonLabel: string;
  viewProfileLabel: string;
  verifiedLabel: string;
}

/** Structurally matches the shell components' AppNavLinks / AppNavLabels contracts. */
export interface AppShellNavVM {
  links: {
    home: string;
    search: string;
    members: string;
    chat: string;
    notifications: string;
    profile: string;
    settings: string;
    saved: string;
    kinkcoins: string;
    subscription: string;
  };
  labels: {
    home: string;
    search: string;
    members: string;
    chat: string;
    notifications: string;
    profile: string;
    settings: string;
    saved: string;
    kinkcoins: string;
    subscription: string;
    logout: string;
  };
  /** The phone drawer's account menu. */
  drawer: AppShellDrawerVM;
}

/** The account menu (Philip's design): live entries first, then Settings & Privacy's groups. */
function drawerNavigation(): AppShellDrawerVM {
  const nav = MEMBERS_COPY.nav;
  const copy = MEMBERS_COPY.accountMenu;
  return {
    menuLabel: copy.menuLabel,
    primary: [
      {
        key: "members",
        label: nav.members,
        href: Routes.members,
        icon: "members",
        count: "members",
        nav: "members",
      },
      { key: "saved", label: nav.saved, href: Routes.saved, icon: "saved", nav: "saved" },
      {
        key: "kinkopedia",
        label: copy.kinkopedia,
        href: Routes.kinkopediaInApp,
        icon: "kinkopedia",
        soon: true,
      },
      {
        key: "verification",
        label: copy.verification,
        href: Routes.settingsVerification,
        icon: "verification",
        verification: true,
      },
      {
        key: "kinkcoins",
        label: nav.kinkcoins,
        href: Routes.kinkcoins,
        icon: "coins",
        nav: "kinkcoins",
      },
      { key: "silver", label: nav.subscription, href: Routes.subscription, icon: "subscription" },
      {
        key: "marketplace",
        label: copy.marketplace,
        href: Routes.marketplace,
        icon: "marketplace",
        soon: true,
      },
    ],
    settingsLabel: copy.settings,
    settingsGroups: [
      {
        label: copy.groups.account,
        items: [
          {
            key: "account-settings",
            label: copy.accountSettings,
            href: Routes.settings,
            icon: "account",
            nav: "settings",
          },
          {
            key: "your-data",
            label: copy.yourData,
            href: Routes.settingsData,
            icon: "data",
            soon: true,
          },
        ],
      },
      {
        label: copy.groups.privacy,
        items: [
          { key: "privacy", label: copy.privacy, href: Routes.settingsPrivacy, icon: "privacy" },
          {
            key: "security",
            label: copy.security,
            href: Routes.settingsSecurity,
            icon: "security",
          },
        ],
      },
      {
        label: copy.groups.preference,
        items: [
          {
            key: "content-experience",
            label: copy.content,
            href: Routes.settingsContent,
            icon: "content",
            soon: true,
          },
        ],
      },
      {
        label: copy.groups.safety,
        items: [
          {
            key: "community-safety",
            label: copy.communitySafety,
            href: Routes.settingsCommunitySafety,
            icon: "safety",
            soon: true,
          },
        ],
      },
      {
        label: copy.groups.support,
        items: [
          { key: "help-support", label: copy.help, href: Routes.contact, icon: "support" },
          { key: "about", label: copy.about, href: Routes.about, icon: "about" },
        ],
      },
    ],
    soonLabel: copy.soon,
    viewProfileLabel: copy.viewProfile,
    verifiedLabel: MEMBERS_COPY.profile.about.verified.identity,
  };
}

/** Display-ready nav (hrefs + copy) for every AppShell screen. */
export function getAppShellNav(): AppShellNavVM {
  return {
    links: {
      home: Routes.appHome,
      search: Routes.search,
      members: Routes.members,
      chat: Routes.messages,
      notifications: Routes.notifications,
      profile: Routes.profile,
      settings: Routes.settings,
      saved: Routes.saved,
      kinkcoins: Routes.kinkcoins,
      subscription: Routes.subscription,
    },
    labels: { ...MEMBERS_COPY.nav },
    drawer: drawerNavigation(),
  };
}

/** What every post-login screen hands `AppShell`, built from the home presenter + nav. */
export interface ShellSource {
  greeting: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  membersCount: string;
  notificationsUnread?: boolean;
  notificationsCount?: number;
  messagesCount?: number;
  /** Whether the drawer lists Verification: only while it's open to the member. */
  verificationEntry?: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  logout: () => void;
}

export function appShellProps(home: ShellSource, nav: ReturnType<typeof getAppShellNav>) {
  return {
    brand: BRAND_NAME,
    tagline: "THE WORLD'S KINK COMMUNITY",
    greeting: home.greeting,
    name: home.name,
    handle: home.handle,
    avatarUrl: home.avatarUrl,
    membersCount: home.membersCount,
    notificationsUnread: home.notificationsUnread,
    notificationsCount: home.notificationsCount,
    messagesCount: home.messagesCount,
    drawerOpen: home.drawerOpen,
    onMenu: home.openDrawer,
    onCloseDrawer: home.closeDrawer,
    onLogout: home.logout,
    links: nav.links,
    labels: nav.labels,
    drawerNavigation: nav.drawer,
    verificationEntry: home.verificationEntry,
  };
}
