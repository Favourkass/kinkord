// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAboutPresenter } from "./useAboutPresenter";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/services/apiClient", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ avatarUrl: null }),
  },
}));

vi.mock("@/services/authClient", () => ({
  authClient: {
    signOut: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

describe("useAboutPresenter", () => {
  it("exposes brand, title, meet the team CTA, teamHref, and guest status", () => {
    const { result } = renderHook(() => useAboutPresenter());

    expect(result.current.brand).toBe("KINKORD");
    expect(result.current.aboutTitle).toBe("ABOUT");
    expect(result.current.aboutTitleAccent).toBe("KINKORD");
    expect(result.current.meetTeamCta).toBe("MEET THE TEAM");
    expect(result.current.teamHref).toBe("/about/team");
    expect(result.current.policyLinks).toHaveLength(10);
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.loginHref).toBe("/login");
    expect(result.current.signupHref).toBe("/signup");
  });

  it("toggles drawer state open and closed", () => {
    const { result } = renderHook(() => useAboutPresenter());

    expect(result.current.drawerOpen).toBe(false);

    act(() => {
      result.current.openDrawer();
    });
    expect(result.current.drawerOpen).toBe(true);

    act(() => {
      result.current.closeDrawer();
    });
    expect(result.current.drawerOpen).toBe(false);
  });
});
