// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PwaInstallBanner } from "./PwaInstallBanner";

const artwork = {
  src: "/brand/kinkord-install.gif",
  alt: "Install Kinkord",
  width: 720,
  height: 1280,
};
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
