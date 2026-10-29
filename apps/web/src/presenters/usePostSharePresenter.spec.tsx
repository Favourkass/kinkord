// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { groupsService, sharingService } from "@/services/sharing.service";
import { usePostSharePresenter } from "./usePostSharePresenter";
vi.mock("@/services/sharing.service", () => ({
  groupsService: { friends: vi.fn(), list: vi.fn() },
  sharingService: { feed: vi.fn(), group: vi.fn(), friend: vi.fn(), external: vi.fn() },
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(groupsService.friends).mockResolvedValue([]);
  vi.mocked(groupsService.list).mockResolvedValue([]);
});
it("opens options without sharing anything", () => {
  const done = vi.fn();
  const { result } = renderHook(() => usePostSharePresenter(done));
  act(() => result.current.open("p"));
  expect(result.current.dialog.open).toBe(true);
  expect(result.current.dialog.mode).toBe("choices");
  expect(sharingService.feed).not.toHaveBeenCalled();
});
it("submits the caption once even with a double tap", async () => {
  let resolve!: (v: never) => void;
  vi.mocked(sharingService.feed).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const done = vi.fn();
  const { result } = renderHook(() => usePostSharePresenter(done));
  act(() => result.current.open("p"));
  act(() => result.current.dialog.onCaption("My caption"));
  act(() => {
    result.current.dialog.onFeed();
    result.current.dialog.onFeed();
    result.current.dialog.onClose();
  });
  expect(sharingService.feed).toHaveBeenCalledTimes(1);
  expect(sharingService.feed).toHaveBeenCalledWith("p", "My caption");
  expect(result.current.dialog.open).toBe(true);
  await act(async () => resolve({ postId: "p", shares: 1, item: null } as never));
  expect(result.current.dialog.open).toBe(false);
  expect(done).toHaveBeenCalledOnce();
});
it("keeps a failed draft open and preserves its caption", async () => {
  vi.mocked(sharingService.feed).mockRejectedValue(new Error("Not allowed"));
  const { result } = renderHook(() => usePostSharePresenter(vi.fn()));
  act(() => result.current.open("p"));
  act(() => result.current.dialog.onCaption("Keep this"));
  await act(async () => result.current.dialog.onFeed());
  expect(result.current.dialog.open).toBe(true);
  expect(result.current.dialog.caption).toBe("Keep this");
  expect(result.current.dialog.error).toBe("Not allowed");
});
it("offers only joined groups", async () => {
  vi.mocked(groupsService.list).mockResolvedValue([
    { id: "a", name: "Joined", ownerId: "me", status: "joined" },
    { id: "b", name: "Invited", ownerId: "other", status: "invited" },
  ]);
  const { result } = renderHook(() => usePostSharePresenter(vi.fn()));
  act(() => result.current.open("p"));
  act(() => result.current.dialog.onMode("groups"));
  await waitFor(() => expect(result.current.dialog.groups).toHaveLength(1));
  expect(result.current.dialog.groups[0].id).toBe("a");
});
it("reuses the same message id on a failed friend-send retry", async () => {
  vi.mocked(sharingService.friend).mockRejectedValue(new Error("Offline"));
  const { result } = renderHook(() => usePostSharePresenter(vi.fn()));
  act(() => result.current.open("p"));
  await act(async () => result.current.dialog.onFriend("f"));
  await act(async () => result.current.dialog.onFriend("f"));
  const calls = vi.mocked(sharingService.friend).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0][3]).toBe(calls[1][3]);
});
