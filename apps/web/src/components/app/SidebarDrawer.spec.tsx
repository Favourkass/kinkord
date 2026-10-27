// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import SidebarDrawer from "./SidebarDrawer";

afterEach(cleanup);

function renderDrawer({
  verificationEntry = false,
  active,
}: { verificationEntry?: boolean; active?: "saved" } = {}) {
  const nav = getAppShellNav();
  const onClose = vi.fn();
  render(
    <SidebarDrawer
      open
      onClose={onClose}
      name="Kinkord Official"
      avatarUrl={null}
      membersCount="110"
      verified
      verificationEntry={verificationEntry}
      active={active}
      links={nav.links}
      labels={nav.labels}
      navigation={nav.drawer}
      onLogout={vi.fn()}
    />,
  );
  return { onClose };
}

const entries = () =>
  Array.from(screen.getByRole("navigation", { name: "Account menu" }).querySelectorAll("a")).map(
    (link) => link.textContent?.replace(/110|Soon/g, "").trim(),
  );

describe("SidebarDrawer", () => {
  it("lists the account menu in Philip's order, with Settings & Privacy collapsed", () => {
    renderDrawer({ verificationEntry: true });
    expect(entries()).toEqual([
      "Members",
      "Saved",
      "Kinkopedia",
      "Verification",
      "KinkCoins & Payment",
      "Silver Premium",
      "Kink Rings",
      "Marketplace",
    ]);
    expect(screen.queryByText("Account Settings")).toBeNull();
  });

  it("leaves Verification out while it isn't open to the member", () => {
    renderDrawer();
    expect(entries()).not.toContain("Verification");
    expect(entries()).toHaveLength(7);
  });

  it("marks only the unfinished entries as Soon, and the current page", () => {
    renderDrawer({ active: "saved" });
    // Kinkopedia and Marketplace; KinkCoins and Silver Premium are live.
    expect(screen.getAllByText("Soon")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Silver Premium/ }).getAttribute("href")).toBe(
      "/subscription",
    );
    expect(screen.getByRole("link", { name: /Saved/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Identity verified")).toBeTruthy();
  });

  it("opens Settings & Privacy into its groups", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Settings & Privacy" }));
    expect(screen.getByText("Account Settings")).toBeTruthy();
    expect(screen.getByText("Community & Safety")).toBeTruthy();
    expect(screen.getByText("About Kinkord")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Settings & Privacy" }));
    expect(screen.queryByText("Account Settings")).toBeNull();
  });

  it("closes after a destination is chosen", () => {
    const { onClose } = renderDrawer();
    fireEvent.click(screen.getByRole("link", { name: /Kinkopedia/ }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
