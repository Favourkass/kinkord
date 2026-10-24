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

describe("the account menu", () => {
  const { drawer } = getAppShellNav();
  const byKey = (key: string) =>
    [...drawer.primary, ...drawer.settingsGroups.flatMap((g) => g.items)].find(
      (i) => i.key === key,
    );

  it("keeps Philip's order, with Silver Premium and KinkCoins live", () => {
    expect(drawer.primary.map((i) => i.label)).toEqual([
      "Members",
      "Saved",
      "Kinkopedia",
      "Verification",
      "KinkCoins & Payment",
      "Silver Premium",
      "Marketplace",
    ]);
    expect(byKey("silver")).toMatchObject({ href: "/subscription" });
    expect(byKey("silver")?.soon).toBeUndefined();
    expect(byKey("kinkcoins")).toMatchObject({ href: "/kinkcoins", nav: "kinkcoins" });
    expect(byKey("kinkcoins")?.soon).toBeUndefined();
  });

  it("marks Verification as listed only while it's open", () => {
    expect(byKey("verification")).toMatchObject({
      href: "/settings/verification",
      verification: true,
    });
  });

  it("sends every unfinished entry to its coming-soon screen", () => {
    const soon = [...drawer.primary, ...drawer.settingsGroups.flatMap((g) => g.items)].filter(
      (i) => i.soon,
    );
    expect(soon.map((i) => i.key)).toEqual([
      "kinkopedia",
      "marketplace",
      "your-data",
      "content-experience",
      "community-safety",
    ]);
    for (const item of soon) expect(item.href.startsWith("/coming-soon/")).toBe(true);
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
    expect(props.drawerNavigation).toBe(nav.drawer);
    expect(props.verificationEntry).toBeUndefined();
  });
});
