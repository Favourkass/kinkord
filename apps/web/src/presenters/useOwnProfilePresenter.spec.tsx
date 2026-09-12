// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOwnProfilePresenter } from "./useOwnProfilePresenter";

const replace = vi.fn();
const router = { push: vi.fn(), replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const me = vi.fn();
vi.mock("@/services/profile.service", () => ({ profileApi: { me: () => me() } }));

const apiGet = vi.fn();
vi.mock("@/services/apiClient", () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super(`API ${status}`);
    }
  }
  return { api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), del: vi.fn() }, ApiError };
});

const profile = {
  userId: "me",
  username: "maxwell",
  displayName: "Maxwell",
  avatarUrl: null,
  coverUrl: null,
  bio: null,
  country: "NG",
  state: "Delta",
  city: null,
  age: 30,
  gender: "Male",
  orientation: null,
  relationshipStatus: null,
  bodyType: null,
  roles: [],
  interests: [],
  lookingFor: [],
  languages: [],
  joinedAt: "2025-05-25T10:00:00.000Z",
  lastSeenAt: null,
  isOnline: true,
  counts: { friends: 0, followers: 0, following: 0, mutualFriends: 0 },
  isFollowing: false,
  isSelf: true,
  nationality: null,
  occupation: null,
  limits: null,
  socialLinks: {},
  restricted: false,
  dateOfBirth: "1996-01-01",
  verification: { email: true, phone: false },
};

describe("useOwnProfilePresenter", () => {
  beforeEach(() => {
    me.mockReset().mockResolvedValue({ username: "maxwell" });
    apiGet.mockReset().mockResolvedValue(profile);
  });

  it("resolves your handle from /me, then loads your profile with the owner's actions", async () => {
    const { result } = renderHook(() => useOwnProfilePresenter(null));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet).toHaveBeenCalledWith("/profiles/maxwell");
    expect(result.current.vm).toMatchObject({ isSelf: true, memberSince: "25 May 2025" });
    expect(result.current.vm?.personal.dateOfBirth).toBe("1 January 1996");
    expect(result.current.activeTab).toBe("profile");
    expect(result.current.editHref).toBe("/profile/edit");
  });

  it("reports an account without a handle instead of spinning forever", async () => {
    me.mockResolvedValue({ username: null });
    const { result } = renderHook(() => useOwnProfilePresenter(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toMatch(/went wrong/);
    expect(apiGet).not.toHaveBeenCalled();
  });
});
