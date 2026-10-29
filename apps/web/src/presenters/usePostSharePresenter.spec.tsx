// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { sharingService } from "@/services/sharing.service";
import { profileApi } from "@/services/profile.service";
import { usePostSharePresenter } from "./usePostSharePresenter";
vi.mock("@/services/sharing.service", () => ({
  sharingService: { friends: vi.fn(), feed: vi.fn(), friend: vi.fn(), external: vi.fn() },
}));
vi.mock("@/services/profile.service", () => ({
  profileApi: { own: vi.fn().mockResolvedValue({ displayName: "Alex", avatarUrl: null }) },
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(profileApi.own).mockResolvedValue({ displayName: "Alex", avatarUrl: null } as Awaited<
    ReturnType<typeof profileApi.own>
  >);
  vi.mocked(sharingService.friends).mockResolvedValue([]);
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
it("searches friends from the full list and settles its loading state", async () => {
  const { result } = renderHook(() => usePostSharePresenter(vi.fn()));
  act(() => result.current.open("p"));
  act(() => result.current.dialog.onMode("friends"));
  act(() => result.current.dialog.onQuery("sa"));
  await waitFor(() => expect(sharingService.friends).toHaveBeenLastCalledWith("sa"));
  await waitFor(() => expect(result.current.dialog.loading).toBe(false));
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
it("loads friend shortcuts and the member identity as soon as the sheet opens", async () => {
  vi.mocked(sharingService.friends).mockResolvedValue([
    { userId: "f", displayName: "Sam", username: "sam" },
  ]);
  const { result } = renderHook(() => usePostSharePresenter(vi.fn()));
  act(() => result.current.open("p"));
  await waitFor(() =>
    expect(result.current.dialog.friends).toEqual([{ id: "f", name: "Sam", initial: "S" }]),
  );
  expect(result.current.dialog.viewer.name).toBe("Alex");
  expect(result.current.dialog.mode).toBe("choices");
  expect(sharingService.friend).not.toHaveBeenCalled();
});
