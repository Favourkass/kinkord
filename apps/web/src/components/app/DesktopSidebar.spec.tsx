// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import DesktopSidebar from "./DesktopSidebar";

afterEach(cleanup);

function renderSidebar(settingsOpen = false) {
  const nav = getAppShellNav();
  const onToggleSettings = vi.fn();
  render(
    <DesktopSidebar
      brand="KINKORD"
      active="members"
      avatarUrl={null}
      membersCount="110"
      links={nav.links}
      labels={nav.labels}
      navigation={nav.drawer}
      settingsOpen={settingsOpen}
      onToggleSettings={onToggleSettings}
      onLogout={vi.fn()}
    />,
  );
  return { onToggleSettings };
}

describe("DesktopSidebar", () => {
  it("mirrors the client-approved account order while settings stay collapsed", () => {
    renderSidebar();
    const menu = screen.getByRole("navigation", { name: "Desktop account menu" });
    expect(
      within(menu)
        .getAllByRole("link")
        .map((link) => link.textContent?.replace("110", "")),
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

  it("reveals grouped settings only after the user opens Settings & Privacy", () => {
    const { onToggleSettings } = renderSidebar(true);
    expect(screen.getByText("Account Settings")).toBeTruthy();
    expect(screen.getByText("Community & Safety")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Settings & Privacy" }));
    expect(onToggleSettings).toHaveBeenCalledOnce();
  });
});
