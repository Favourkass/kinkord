/** Shared nav contracts for the post-login shell (mobile tab bar, drawer, desktop sidebar). */

export type AppTab = "home" | "chat" | "notifications" | "profile";

export type AppNav =
  | "home"
  | "search"
  | "members"
  | "chat"
  | "notifications"
  | "profile"
  | "settings"
  | "saved"
  | "edit-profile"
  | "security"
  | "verification"
  | "none";

export interface AppNavLinks {
  home: string;
  search: string;
  members: string;
  chat: string;
  notifications: string;
  profile: string;
  settings: string;
  saved: string;
  subscription: string;
}

export interface AppNavLabels {
  home: string;
  search: string;
  members: string;
  chat: string;
  notifications: string;
  profile: string;
  settings: string;
  saved: string;
  subscription: string;
  logout: string;
}

export type DrawerIcon =
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

export interface DrawerNavItem {
  key: string;
  label: string;
  href: string;
  icon: DrawerIcon;
  count?: "members";
  /** Marked as the current page when the shell's active nav matches. */
  nav?: AppNav;
  /** Not built yet: the link opens a "coming soon" screen. */
  soon?: boolean;
}

export interface DrawerNavGroup {
  label: string;
  items: DrawerNavItem[];
}

export interface DrawerNavigation {
  menuLabel: string;
  primary: DrawerNavItem[];
  settingsLabel: string;
  settingsGroups: DrawerNavGroup[];
  soonLabel: string;
  viewProfileLabel: string;
  verifiedLabel: string;
}
