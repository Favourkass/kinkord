// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTeamPresenter } from "./useTeamPresenter";

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

const teamList = vi.fn().mockResolvedValue([]);
vi.mock("@/services/team.service", () => ({ teamApi: { list: () => teamList() } }));

vi.mock("@/services/authClient", () => ({
  authClient: {
    signOut: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

describe("useTeamPresenter", () => {
  it("exposes team title, founder message, Tega Maxwell CEO profile, and guest status", () => {
    const { result } = renderHook(() => useTeamPresenter());

    expect(result.current.brand).toBe("KINKORD");
    expect(result.current.teamTitle).toBe("MEET THE");
    expect(result.current.teamTitleAccent).toBe("TEAM");
    expect(result.current.policyLinks).toHaveLength(8);
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.loginHref).toBe("/login");
    expect(result.current.signupHref).toBe("/signup");

    expect(result.current.founderMessage.founderName).toBe("Tega Maxwell");
    expect(result.current.ceo.name).toBe("Tega Maxwell");
    expect(result.current.ceo.role).toBe("CEO & Founder");
    expect(result.current.showProfile).toBe(false);
  });

  it("shows the team the founders picked under the CEO, with their roles", async () => {
    teamList.mockResolvedValueOnce([
      { username: "ada", displayName: "Ada", avatarUrl: null, title: "Software Engineer" },
      { username: "kemi", displayName: "Kemi", avatarUrl: null, title: "Community Educator" },
    ]);
    const { result } = renderHook(() => useTeamPresenter());
    expect(result.current.teamMembers).toEqual([]);
    await waitFor(() => expect(result.current.teamMembers).toHaveLength(2));
    expect(result.current.teamMembers.map((m) => [m.name, m.handle, m.title, m.href])).toEqual([
      ["Ada", "@ada", "Software Engineer", "/u/ada"],
      ["Kemi", "@kemi", "Community Educator", "/u/kemi"],
    ]);
  });

  it("keeps the CEO's card when the team can't be loaded", async () => {
    teamList.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTeamPresenter());
    await waitFor(() => expect(teamList).toHaveBeenCalled());
    expect(result.current.teamMembers).toEqual([]);
    expect(result.current.ceo.name).toBe("Tega Maxwell");
  });

  it("toggles member profile view open and closed", () => {
    const { result } = renderHook(() => useTeamPresenter());

    expect(result.current.showProfile).toBe(false);

    act(() => {
      result.current.openProfile();
    });
    expect(result.current.showProfile).toBe(true);

    act(() => {
      result.current.closeProfile();
    });
    expect(result.current.showProfile).toBe(false);
  });

  it("toggles drawer state open and closed", () => {
    const { result } = renderHook(() => useTeamPresenter());

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

  it("handles topic selection and clearing for in-page content changes", () => {
    const { result } = renderHook(() => useTeamPresenter());

    expect(result.current.founderTopics).toHaveLength(13);
    expect(result.current.founderTopics.find((t) => t.id === "support-my-work")?.comingSoon).toBe(
      true,
    );
    expect(result.current.selectedTopicId).toBeNull();
    expect(result.current.selectedTopic).toBeNull();

    act(() => {
      result.current.selectTopic("support-my-work");
    });
    expect(result.current.selectedTopicId).toBeNull();
    expect(result.current.selectedTopic).toBeNull();

    act(() => {
      result.current.selectTopic("work-with-me");
    });
    expect(result.current.selectedTopicId).toBe("work-with-me");
    expect(result.current.selectedTopic?.title).toBe("Work with Me");

    act(() => {
      result.current.clearTopic();
    });
    expect(result.current.selectedTopicId).toBeNull();
    expect(result.current.selectedTopic).toBeNull();

    act(() => {
      result.current.selectTopic("my-mission");
    });
    expect(result.current.selectedTopicId).toBe("my-mission");
    expect(result.current.selectedTopic?.title).toBe("My Mission");

    act(() => {
      result.current.clearTopic();
    });
    expect(result.current.selectedTopicId).toBeNull();
    expect(result.current.selectedTopic).toBeNull();

    act(() => {
      result.current.selectTopic("founders-journey");
      result.current.closeProfile();
    });
    expect(result.current.selectedTopicId).toBeNull();
    expect(result.current.showProfile).toBe(false);
  });
});
