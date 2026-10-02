/** Shared nav contracts for the post-login shell (mobile tab bar, drawer, desktop sidebar). */

export type AppTab = "home" | "chat" | "notifications" | "profile";

export type AppNav =
  | "home" | "members" | "chat" | "notifications" | "profile"
  | "settings" | "saved" | "edit-profile" | "none";

export interface AppNavLinks {
  home: string;
  members: string;
  chat: string;
  notifications: string;
  profile: string;
  settings: string;
  saved: string;
}

export interface AppNavLabels {
  home: string;
  members: string;
  chat: string;
  notifications: string;
  profile: string;
  settings: string;
  saved: string;
  logout: string;
}

export type DrawerIcon =
  | "members" | "saved" | "kinkopedia" | "verification" | "coins" | "subscription"
  | "marketplace" | "account" | "data" | "privacy" | "security" | "content"
  | "safety" | "support" | "about";

export interface DrawerNavItem {
  key: string;
  label: string;
  href: string;
  icon: DrawerIcon;
  count?: "members";
}

export interface DrawerNavGroup {
  label: string;
  items: DrawerNavItem[];
}

export interface DrawerNavigation {
  primary: DrawerNavItem[];
  settingsLabel: string;
  settingsGroups: DrawerNavGroup[];
}
