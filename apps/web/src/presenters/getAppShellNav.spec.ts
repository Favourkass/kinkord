import { describe, expect, it } from "vitest";
import { appShellProps, getAppShellNav } from "./getAppShellNav";

describe("getAppShellNav", () => {
  it("maps every nav item to its route and label", () => {
    const nav = getAppShellNav();
    expect(nav.links).toEqual({
      home: "/home",
      search: "/search",
      members: "/members",
      chat: "/messages",
      notifications: "/notifications",
      profile: "/profile",
      settings: "/settings",
      saved: "/saved",
      kinkcoins: "/kinkcoins",
      subscription: "/subscription",
    });
    expect(nav.labels).toEqual({
      home: "Home",
      search: "Search",
      members: "Members",
      chat: "Chat",
      notifications: "Notifications",
      profile: "Profile",
      settings: "Settings and Privacy",
      saved: "Saved",
      kinkcoins: "KinkCoins & Payment",
      subscription: "Silver Premium",
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
    expect(props).toMatchObject({ brand: "Kinkord", greeting: "Hi Tega", membersCount: "128" });
    expect(props.onMenu).toBe(openDrawer);
    expect(props.links).toBe(nav.links);
  });
});
