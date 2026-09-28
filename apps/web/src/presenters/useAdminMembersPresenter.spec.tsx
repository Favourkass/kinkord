// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AdminMemberPM } from "@/domain/moderation";
import { useAdminMembersPresenter } from "./useAdminMembersPresenter";

const access = vi.fn();
const search = vi.fn();
vi.mock("@/services/moderation.service", () => ({
  moderationService: {
    access: () => access(),
    search: (...a: unknown[]) => search(...a),
  },
}));

const member: AdminMemberPM = {
  id: "u9",
  name: "Durowara Tolulope Charles",
  displayName: null,
  username: "downtoearth",
  email: "ctolulope05@gmail.com",
  phone: null,
  avatarUrl: null,
  createdAt: "2026-09-04T16:24:27.065Z",
  lastSeenAt: null,
  posts: 3,
  banned: false,
  admin: false,
};

describe("useAdminMembersPresenter", () => {
  beforeEach(() => {
    access.mockReset().mockResolvedValue({ isAdmin: true });
    search.mockReset().mockResolvedValue([member]);
  });
  afterEach(cleanup);

  it("lists the newest members straight away", async () => {
    const { result } = renderHook(() => useAdminMembersPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(search).toHaveBeenCalledWith("");
    expect(result.current.heading).toBe("Newest members");
    expect(result.current.rows[0].href).toBe("/moderation/members/u9");
    expect(result.current.loading).toBe(false);
  });

  it("searches what was typed and says so", async () => {
    const { result } = renderHook(() => useAdminMembersPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setQuery("tolu"));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("tolu"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.heading).toBe("Results for “tolu”");
  });

  it("says when nothing matches", async () => {
    search.mockResolvedValue([]);
    const { result } = renderHook(() => useAdminMembersPresenter());
    await waitFor(() => expect(result.current.empty).toBe(true));
  });

  it("never searches for someone who isn't an admin", async () => {
    access.mockResolvedValue({ isAdmin: false });
    const { result } = renderHook(() => useAdminMembersPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(search).not.toHaveBeenCalled();
  });
});
