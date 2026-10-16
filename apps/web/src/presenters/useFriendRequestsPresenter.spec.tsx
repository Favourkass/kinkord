// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { friendshipService } from "@/services/friendship.service";
import { useFriendRequestsPresenter } from "./useFriendRequestsPresenter";
vi.mock("@/services/friendship.service", () => ({
  friendshipService: { requests: vi.fn(), change: vi.fn() },
}));
const request = {
  id: "r1",
  userId: "a",
  username: "ada",
  displayName: "Ada",
  avatarUrl: null,
  createdAt: "2026-10-16T00:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(friendshipService.requests).mockResolvedValue({ items: [request], hasMore: false });
  vi.mocked(friendshipService.change).mockResolvedValue({ friendship: "friends" });
});
afterEach(cleanup);
describe("friend requests presenter", () => {
  it("loads received requests and accepts through friendship rather than follow", async () => {
    const { result } = renderHook(() => useFriendRequestsPresenter());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(friendshipService.requests).toHaveBeenCalledWith("incoming", 1);
    expect(result.current.items[0].primaryLabel).toBe("Accept request");
    vi.mocked(friendshipService.requests).mockResolvedValue({ items: [], hasMore: false });
    act(() => result.current.items[0].onPrimary());
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(friendshipService.change).toHaveBeenCalledWith("ada", "accept");
  });
  it("can decline received requests and cancel sent ones", async () => {
    const { result } = renderHook(() => useFriendRequestsPresenter());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.items[0].onSecondary());
    await waitFor(() => expect(friendshipService.change).toHaveBeenCalledWith("ada", "dismiss"));
    act(() => result.current.setDirection("outgoing"));
    await waitFor(() => expect(result.current.items[0]?.primaryLabel).toBe("Cancel request"));
    expect(result.current.items[0].secondaryLabel).toBeNull();
    expect(friendshipService.requests).toHaveBeenCalledWith("outgoing", 1);
  });
  it("keeps the pending request and explains failures", async () => {
    vi.mocked(friendshipService.change).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useFriendRequestsPresenter());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.items[0].onPrimary());
    await waitFor(() => expect(result.current.error).toContain("Could not update"));
    expect(result.current.items).toHaveLength(1);
  });
});
