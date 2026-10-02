// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ExpandableAvatar from "./ExpandableAvatar";

// framer-motion's layout animations need a real layout engine; jsdom has none.
// The behaviour under test is the dialog, the scroll lock and focus — not the
// tween — so motion is reduced to the plain elements it renders.
const MOTION_PROPS = ["layoutId", "transition", "initial", "animate", "exit"];

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = (props: Record<string, unknown>) => {
          const rest = Object.fromEntries(
            Object.entries(props).filter(([key]) => !MOTION_PROPS.includes(key)),
          );
          const Tag = tag as "button";
          return <Tag {...rest} />;
        };
        Component.displayName = `motion.${tag}`;
        return Component;
      },
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

const open = () => fireEvent.click(screen.getByRole("button", { name: "View Sudom" }));

afterEach(() => {
  // vitest isn't in globals mode here, so Testing Library's auto-cleanup is off.
  cleanup();
  document.body.style.overflow = "";
});

describe("ExpandableAvatar", () => {
  it("renders nothing for a member with no photo", () => {
    const { container } = render(<ExpandableAvatar src={null} alt="Sudom" />);
    expect(container.innerHTML).toBe("");
  });

  it("opens a labelled modal dialog from the avatar", async () => {
    render(<ExpandableAvatar src="https://s3/a.jpg" alt="Sudom" />);
    expect(screen.queryByRole("dialog")).toBeNull();

    open();

    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Sudom");
  });

  it("closes on Escape, on the backdrop, and on the image itself", async () => {
    render(<ExpandableAvatar src="https://s3/a.jpg" alt="Sudom" />);

    open();
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    open();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    open();
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(dialog.querySelector("img") as HTMLImageElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("locks body scroll while open and restores exactly what was there", async () => {
    document.body.style.overflow = "scroll";
    render(<ExpandableAvatar src="https://s3/a.jpg" alt="Sudom" />);

    open();
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.body.style.overflow).toBe("scroll"));
  });

  it("moves focus onto the close button and back to the avatar", async () => {
    // The trigger unmounts while the viewer is open, so without this focus
    // would fall to <body> and never come back.
    render(<ExpandableAvatar src="https://s3/a.jpg" alt="Sudom" />);

    open();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" })),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "View Sudom" })),
    );
  });

  it("keeps Tab inside the dialog", async () => {
    render(<ExpandableAvatar src="https://s3/a.jpg" alt="Sudom" />);
    open();
    await screen.findByRole("dialog");

    const close = screen.getByRole("button", { name: "Close" });
    act(() => close.blur());
    fireEvent.keyDown(document, { key: "Tab" });

    await waitFor(() => expect(document.activeElement).toBe(close));
  });

  it("labels the trigger with the action, not just the photo", () => {
    render(<ExpandableAvatar src="https://s3/a.jpg" alt="Sudom" />);
    expect(screen.getByRole("button", { name: "View Sudom" })).toBeTruthy();
  });
});
