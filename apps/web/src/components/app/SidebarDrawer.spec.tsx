// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import SidebarDrawer from "./SidebarDrawer";

afterEach(cleanup);

function renderDrawer(settingsOpen = false, active?: "saved") {
  const nav = getAppShellNav();
  const onClose = vi.fn();
  const onToggleSettings = vi.fn();
  render(
    <SidebarDrawer
      open
      onClose={onClose}
      name="Kinkord Official"
      avatarUrl={null}
      membersCount="110"
      verified
      active={active}
      links={nav.links}
      labels={nav.labels}
      navigation={nav.drawer}
      settingsOpen={settingsOpen}
      onToggleSettings={onToggleSettings}
      onLogout={vi.fn()}
    />,
  );
  return { onClose, onToggleSettings };
}

describe("SidebarDrawer", () => {
  it("renders the requested primary order while settings children stay collapsed", () => {
    renderDrawer();
    const links = screen.getByRole("navigation", { name: "Account menu" }).querySelectorAll("a");
    expect(
      Array.from(links).map((link) => link.textContent?.replace(/110|Soon/g, "").trim()),
    ).toEqual([
      "Members",
      "Saved",
      "Kinkopedia",
      "Verification",
      "KinkCoins & Payment",
      "Subscription",
      "Marketplace",
    ]);
    expect(screen.queryByText("Account Settings")).toBeNull();
  });

  it("marks the unfinished destinations and the current page", () => {
    renderDrawer(false, "saved");
    expect(screen.getAllByText("Soon")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /Saved/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Members/ }).getAttribute("aria-current")).toBeNull();
    // The seal is decorative; the words are for screen readers.
    expect(screen.getByText("Identity verified")).toBeTruthy();
  });

  it("emits the settings toggle and shows all grouped options when expanded", () => {
    const { onToggleSettings } = renderDrawer(true);
    expect(screen.getByText("Account Settings")).toBeTruthy();
    expect(screen.getByText("Community & Safety")).toBeTruthy();
    expect(screen.getByText("About Kinkord")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Settings & Privacy" }));
    expect(onToggleSettings).toHaveBeenCalledOnce();
  });

  it("closes after a destination is selected", () => {
    const { onClose } = renderDrawer();
    fireEvent.click(screen.getByRole("link", { name: /Kinkopedia/ }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
