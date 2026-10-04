// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMessageBadgePresenter } from "./useMessageBadgePresenter";
const { unread, reads, changes } = vi.hoisted(() => ({
  unread: vi.fn(),
  reads: new Set<() => void>(),
  changes: new Set<() => void>(),
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
vi.mock("@/services/realtime.service", () => ({ realtime: { listen: () => () => undefined } }));
afterEach(cleanup);
beforeEach(() => {
  unread.mockReset().mockResolvedValue({ count: 0 });
  reads.clear();
  changes.clear();
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
