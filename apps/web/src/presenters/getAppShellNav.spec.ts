import { describe, expect, it } from "vitest";
import { appShellProps, getAppShellNav } from "./getAppShellNav";

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

describe("appShellProps", () => {
  it("maps the home presenter + nav onto AppShell's props", () => {
    const nav = getAppShellNav();
    const openDrawer = () => {};
    const props = appShellProps(
      {
        greeting: "Hi Tega",
        name: "Tega",
        handle: "@tega",
        avatarUrl: null,
        membersCount: "128",
        drawerOpen: false,
        openDrawer,
        closeDrawer: () => {},
        logout: () => {},
      },
      nav,
    );
    expect(props).toMatchObject({ brand: "KINKORD", greeting: "Hi Tega", membersCount: "128" });
    expect(props.onMenu).toBe(openDrawer);
    expect(props.links).toBe(nav.links);
  });
});
