import { describe, expect, it } from "vitest";
import { getAppShellNav } from "./getAppShellNav";

describe("getAppShellNav", () => {
  it("maps every nav item to its route and label", () => {
    const nav = getAppShellNav();
    expect(nav.links).toEqual({
      home: "/home",
      members: "/members",
      chat: "/messages",
      notifications: "/notifications",
      profile: "/profile",
      settings: "/settings",
    });
    expect(nav.labels).toEqual({
      home: "Home",
      members: "Members",
      chat: "Chat",
      notifications: "Notifications",
      profile: "Profile",
      settings: "Settings and Privacy",
      logout: "Log Out",
    });
  });
});
