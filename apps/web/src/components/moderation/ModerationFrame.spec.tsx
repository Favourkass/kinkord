// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ModerationFrame from "./ModerationFrame";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

describe("ModerationFrame", () => {
  afterEach(cleanup);

  it("wraps every moderation tab instead of hiding later tabs in a scrolling row", () => {
    render(
      <ModerationFrame
        title="Admin"
        tabs={Array.from({ length: 7 }, (_, index) => ({
          label: `Tab ${index + 1}`,
          href: `/tab-${index + 1}`,
          active: index === 0,
        }))}
        checking={false}
        isAdmin
        checkingLabel="Checking"
        deniedLabel="Denied"
      >
        Content
      </ModerationFrame>,
    );

    const nav = screen.getByRole("navigation", { name: "Admin" });
    expect(nav.className).toContain("flex-wrap");
    expect(nav.className).not.toContain("overflow-x-auto");
    expect(screen.getAllByRole("link")).toHaveLength(7);
  });
});
