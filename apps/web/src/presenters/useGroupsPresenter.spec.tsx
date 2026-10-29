// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { groupsService } from "@/services/sharing.service";
import { useGroupsPresenter } from "./useGroupsPresenter";
vi.mock("@/services/sharing.service", () => ({
  groupsService: {
    list: vi.fn(),
    feed: vi.fn(),
    friends: vi.fn(),
    create: vi.fn(),
    accept: vi.fn(),
    leave: vi.fn(),
    invite: vi.fn(),
    remove: vi.fn(),
    removeMember: vi.fn(),
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(groupsService.list).mockResolvedValue([]);
  vi.mocked(groupsService.friends).mockResolvedValue([]);
});
it("caps invitations at 50 and allows deselection", async () => {
  const { result } = renderHook(() => useGroupsPresenter());
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => {
    for (let i = 0; i < 55; i++) result.current.onSelect(String(i));
  });
  expect(result.current.selectedCount).toBe(50);
  act(() => result.current.onSelect("0"));
  expect(result.current.selectedCount).toBe(49);
});
it("sends selected friends and keeps a failed group form open", async () => {
  vi.mocked(groupsService.create).mockRejectedValue(new Error("Try again"));
  const { result } = renderHook(() => useGroupsPresenter());
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => {
    result.current.onCreateToggle();
    result.current.onName("Friends");
    result.current.onSelect("friend");
  });
  await act(async () => result.current.onCreate());
  expect(groupsService.create).toHaveBeenCalledWith("Friends", ["friend"]);
  expect(result.current.creating).toBe(true);
  expect(result.current.error).toBe("Try again");
});
it("invites into an existing group rather than creating a second one", async () => {
  vi.mocked(groupsService.feed).mockResolvedValue({
    group: { id: "g", name: "Group", ownerId: "me", isOwner: true },
    members: [],
    items: [],
    nextPage: null,
  });
  vi.mocked(groupsService.invite).mockResolvedValue({});
  const { result } = renderHook(() => useGroupsPresenter("g"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => {
    result.current.onCreateToggle();
    result.current.onSelect("friend");
  });
  await act(async () => result.current.onCreate());
  expect(groupsService.invite).toHaveBeenCalledWith("g", ["friend"]);
  expect(groupsService.create).not.toHaveBeenCalled();
});
