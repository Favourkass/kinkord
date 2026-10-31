// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PwaInstallBanner } from "./PwaInstallBanner";

const artwork = {
  still: "/brand/kinkord-install-still.webp",
  motion: "/brand/kinkord-install.mp4",
  alt: "Install Kinkord",
  width: 492,
  height: 576,
};
const handlers = () => ({ onInstall: vi.fn(), onDismiss: vi.fn(), onNeverShow: vi.fn() });
afterEach(cleanup);

describe("PwaInstallBanner", () => {
  it("opens installation from the artwork and dismisses independently", () => {
    const h = handlers();
    render(<PwaInstallBanner artwork={artwork} isInstallable isInstalling={false} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: "Install Kinkord App" }));
    expect(h.onInstall).toHaveBeenCalledTimes(1);
    expect(h.onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close install prompt" }));
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
    expect(h.onInstall).toHaveBeenCalledTimes(1);
  });

  it("puts it off for this visit from Not now, and for good from Don't show again", () => {
    const h = handlers();
    render(<PwaInstallBanner artwork={artwork} isInstallable isInstalling={false} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
    expect(h.onNeverShow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Don't show again" }));
    expect(h.onNeverShow).toHaveBeenCalledTimes(1);
  });

  it("shows the still at once, then lets the motion through once it plays", () => {
    const { container } = render(
      <PwaInstallBanner artwork={artwork} isInstallable isInstalling={false} {...handlers()} />,
    );
    const still = screen.getByRole("img", { name: "Install Kinkord" });
    expect(still.getAttribute("src")).toBe("/brand/kinkord-install-still.webp");
    expect(still.className).toContain("opacity-100");
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe("/brand/kinkord-install.mp4");
    expect(video?.muted).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
    fireEvent.playing(video!);
    expect(still.className).toContain("opacity-0");
  });

  it("shows only the still where there's no motion", () => {
    const { container } = render(
      <PwaInstallBanner
        artwork={{ ...artwork, motion: null }}
        isInstallable
        isInstalling={false}
        {...handlers()}
      />,
    );
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("img", { name: "Install Kinkord" }).className).toContain("opacity-100");
  });

  it("prevents duplicate install attempts while the browser prompt is pending", () => {
    const h = handlers();
    render(<PwaInstallBanner artwork={artwork} isInstallable isInstalling {...h} />);
    fireEvent.click(screen.getByRole("button", { name: "Install Kinkord App" }));
    expect(h.onInstall).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Opening installer");
  });

  it("hides the popup when installation is unavailable or dismissed", () => {
    render(
      <PwaInstallBanner
        artwork={artwork}
        isInstallable={false}
        isInstalling={false}
        {...handlers()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Install Kinkord App" })).toBeNull();
  });
});
