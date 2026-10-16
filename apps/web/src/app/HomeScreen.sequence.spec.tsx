// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import HomeScreen from "./HomeScreen";

const splash = vi.hoisted(() => ({
  visible: true,
  leaving: false,
  animate: true,
  videoSrc: "/brand/splash/kinkord-splash-v2.mp4",
  posterSrc: "/brand/splash/kinkord-splash-v2.jpg",
  label: "Kinkord is loading",
  onPlaying: vi.fn(),
  onFinished: vi.fn(),
}));
vi.mock("@/presenters/useBrandSplashPresenter", () => ({ useBrandSplashPresenter: () => splash }));
vi.mock("@/presenters/useLandingPresenter", () => ({
  useLandingPresenter: () => ({ showAgeGate: true }),
}));
vi.mock("@/components/landing/SplashScreen", () => ({
  default: ({ showAgeGate }: { showAgeGate: boolean }) => (
    <main>
      <a href="/signup">Sign up</a>
      {showAgeGate && <div role="dialog" aria-label="Age verification" />}
    </main>
  ),
}));

beforeEach(() => {
  splash.visible = true;
  splash.leaving = false;
});
afterEach(cleanup);

describe("entry screen ordering", () => {
  it("hides the landing content in the initial server HTML and omits the age popup", () => {
    const html = renderToString(<HomeScreen />);
    expect(html).toContain('<div hidden="">');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="dialog"');
  });

  it("shows the loading animation first and reveals the landing and age popup only after its fade", () => {
    const { rerender } = render(<HomeScreen />);
    expect(screen.getByRole("status").textContent).toBe("Kinkord is loading");
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    splash.leaving = true;
    rerender(<HomeScreen />);
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    splash.visible = false;
    rerender(<HomeScreen />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Age verification" })).toBeTruthy();
  });
});
