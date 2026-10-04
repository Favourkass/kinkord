// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BADGE_FALLBACK_POLL_MS, BADGE_POLL_MS } from "./useNotificationBadgePresenter";
import { useMessageBadgePresenter } from "./useMessageBadgePresenter";
const { unread, reads, changes, live } = vi.hoisted(() => ({
  unread: vi.fn(),
  reads: new Set<() => void>(),
  changes: new Set<() => void>(),
  live: { on: false, hear: null as ((e: unknown) => void) | null },
}));
vi.mock("@/services/chat.service", () => ({
  chatService: { unreadCount: unread },
  listenForChatRead: (fn: () => void) => {
    reads.add(fn);
    return () => reads.delete(fn);
  },
}));
vi.mock("@/services/notifications.service", () => ({
  listenForInboxChanges: (fn: () => void) => {
    changes.add(fn);
    return () => changes.delete(fn);
  },
}));
vi.mock("./useRealtime", () => ({
  useRealtime: (fn: (e: unknown) => void, enabled = true) => {
    if (enabled) live.hear = fn;
    return { live: enabled && live.on };
  },
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  unread.mockReset().mockResolvedValue({ count: 0 });
  reads.clear();
  changes.clear();
  live.on = false;
  live.hear = null;
});
it("counts messages, refreshes on reads, and hides on logout", async () => {
  unread.mockResolvedValueOnce({ count: 12 }).mockResolvedValueOnce({ count: 3 });
  const { result, rerender } = renderHook(({ enabled }) => useMessageBadgePresenter(enabled), {
    initialProps: { enabled: true },
  });
  await waitFor(() => expect(result.current).toBe(12));
  act(() => reads.forEach((fn) => fn()));
  await waitFor(() => expect(result.current).toBe(3));
  rerender({ enabled: false });
  expect(result.current).toBe(0);
  expect(reads.size).toBe(0);
});
it("does not fetch before authentication", () => {
  renderHook(() => useMessageBadgePresenter(false));
  expect(unread).not.toHaveBeenCalled();
});
it("refreshes on a live chat event, not on other live events", async () => {
  renderHook(() => useMessageBadgePresenter(true));
  await waitFor(() => expect(unread).toHaveBeenCalledTimes(1));
  act(() => live.hear?.({ type: "notification" }));
  expect(unread).toHaveBeenCalledTimes(1);
  unread.mockResolvedValueOnce({ count: 2 });
  act(() => live.hear?.({ type: "message", conversationId: "c1" }));
  await waitFor(() => expect(unread).toHaveBeenCalledTimes(2));
});
it("checks every five minutes while live events arrive", async () => {
  vi.useFakeTimers();
  live.on = true;
  renderHook(() => useMessageBadgePresenter(true));
  expect(unread).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(BADGE_POLL_MS));
  expect(unread).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(BADGE_FALLBACK_POLL_MS - BADGE_POLL_MS));
  expect(unread).toHaveBeenCalledTimes(2);
});
it("checks every minute while live events can't arrive", async () => {
  vi.useFakeTimers();
  renderHook(() => useMessageBadgePresenter(true));
  expect(unread).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(BADGE_POLL_MS));
  expect(unread).toHaveBeenCalledTimes(2);
});
it("ignores a stale fetch after a newer push refresh", async () => {
  let resolve!: (value: { count: number }) => void;
  unread
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce({ count: 7 });
  const { result } = renderHook(() => useMessageBadgePresenter(true));
  act(() => changes.forEach((fn) => fn()));
  await waitFor(() => expect(result.current).toBe(7));
  await act(async () => resolve({ count: 20 }));
  expect(result.current).toBe(7);
});
