// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PwaInstallBanner } from "./PwaInstallBanner";

const artwork = {
  src: "/brand/kinkord-install.webp",
  still: "/brand/kinkord-install-still.webp",
  alt: "Install Kinkord",
  width: 492,
  height: 576,
};
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});
afterEach(cleanup);

describe("PwaInstallBanner", () => {
  it("opens installation from the artwork and dismisses independently", () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();
    render(
      <PwaInstallBanner
        artwork={artwork}
        isInstallable
        isInstalling={false}
        onInstall={onInstall}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Install Kinkord App" }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close install prompt" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("puts the prompt off from Not now too, and shows a still for reduced motion", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <PwaInstallBanner
        artwork={artwork}
        isInstallable
        isInstalling={false}
        onInstall={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    const source = container.querySelector("source");
    expect(source?.getAttribute("media")).toBe("(prefers-reduced-motion: reduce)");
    expect(source?.getAttribute("srcset")).toBe("/brand/kinkord-install-still.webp");
  });

  it("prevents duplicate install attempts while the browser prompt is pending", () => {
    const onInstall = vi.fn();
    render(
      <PwaInstallBanner
        artwork={artwork}
        isInstallable
        isInstalling
        onInstall={onInstall}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Install Kinkord App" }));
    expect(onInstall).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Opening installer");
  });

  it("dismisses on Escape and restores scrolling when closed", () => {
    const onDismiss = vi.fn();
    const props = {
      artwork,
      isInstallable: true,
      isInstalling: false,
      onInstall: vi.fn(),
      onDismiss,
    };
    const { rerender } = render(<PwaInstallBanner {...props} />);
    const dialog = screen.getByRole("dialog", { name: "Install Kinkord App" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(onDismiss).toHaveBeenCalledOnce();
    rerender(<PwaInstallBanner {...props} isInstallable={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("hides the popup when installation is unavailable or dismissed", () => {
    render(
      <PwaInstallBanner
        artwork={artwork}
        isInstallable={false}
        isInstalling={false}
        onInstall={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Install Kinkord App" })).toBeNull();
  });
});
