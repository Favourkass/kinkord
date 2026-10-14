// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FeedTab, FeedTabVM } from "@/domain/post";
import FeedTabs from "./FeedTabs";

afterEach(cleanup);

const tabs = (selected: FeedTab): FeedTabVM[] =>
  (
    [
      ["for_you", "For You"],
      ["following", "Following"],
      ["nearby", "Nearby"],
    ] as const
  ).map(([value, label]) => ({ value, label, selected: value === selected }));

function show(selected: FeedTab = "for_you") {
  const onSelect = vi.fn();
  render(<FeedTabs label="Home feed" tabs={tabs(selected)} onSelect={onSelect} panelId="panel" />);
  return onSelect;
}

describe("FeedTabs", () => {
  it("is a named tab list whose selected tab alone is in the Tab order", () => {
    show("following");
    expect(screen.getByRole("tablist", { name: "Home feed" })).toBeTruthy();
    const all = screen.getAllByRole("tab");
    expect(all.map((t) => t.textContent)).toEqual(["For You", "Following", "Nearby"]);
    expect(all.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(all.map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
    for (const t of all) expect(t.getAttribute("aria-controls")).toBe("panel");
    expect(all[1].id).toBe("feed-tab-following");
  });

  it("selects a tab when it is tapped", () => {
    const onSelect = show();
    fireEvent.click(screen.getByRole("tab", { name: "Nearby" }));
    expect(onSelect).toHaveBeenCalledWith("nearby");
  });

  it("walks the tabs with the arrow keys, wrapping, and jumps with Home and End", () => {
    const onSelect = show("for_you");
    const [forYou, following, nearby] = screen.getAllByRole("tab");

    fireEvent.keyDown(forYou, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith("following");
    expect(document.activeElement).toBe(following);

    fireEvent.keyDown(forYou, { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenLastCalledWith("nearby");
    expect(document.activeElement).toBe(nearby);

    fireEvent.keyDown(nearby, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith("for_you");

    fireEvent.keyDown(forYou, { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith("nearby");
    fireEvent.keyDown(nearby, { key: "Home" });
    expect(onSelect).toHaveBeenLastCalledWith("for_you");
    expect(document.activeElement).toBe(forYou);
  });

  it("leaves every other key to the browser", () => {
    const onSelect = show();
    fireEvent.keyDown(screen.getAllByRole("tab")[0], { key: "Enter" });
    fireEvent.keyDown(screen.getAllByRole("tab")[0], { key: "ArrowDown" });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
