/** Shared nav contracts for the post-login shell (mobile tab bar, drawer, desktop sidebar). */

export type AppTab = "home" | "chat" | "notifications" | "profile";

export type AppNav =
  "home" | "members" | "chat" | "notifications" | "profile" | "settings" | "edit-profile";

export interface AppNavLinks {
  home: string;
  members: string;
  chat: string;
  notifications: string;
  profile: string;
  settings: string;
}

export interface AppNavLabels {
  home: string;
  members: string;
  chat: string;
  notifications: string;
  profile: string;
  settings: string;
  logout: string;
}
