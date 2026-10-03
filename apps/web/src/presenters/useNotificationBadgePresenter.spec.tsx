// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useNotificationBadgePresenter } from "./useNotificationBadgePresenter";
const { count, listeners } = vi.hoisted(() => ({
  count: vi.fn(),
  listeners: new Set<() => void>(),
}));
vi.mock("@/services/notifications.service", () => ({
  notificationsApi: { unreadCount: count },
  listenForInboxChanges: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
}));
afterEach(cleanup);
beforeEach(() => {
  count.mockReset().mockResolvedValue({ count: 0 });
  listeners.clear();
});
describe("notification badge", () => {
  it("does not request another member's badge before sign-in", () => {
    renderHook(() => useNotificationBadgePresenter(false));
    expect(count).not.toHaveBeenCalled();
  });
  it("updates after read events and hides on logout", async () => {
    count.mockResolvedValueOnce({ count: 2 });
    const { result, rerender } = renderHook(({ ready }) => useNotificationBadgePresenter(ready), {
      initialProps: { ready: true },
    });
    await waitFor(() => expect(result.current).toBe(true));
    act(() => listeners.forEach((fn) => fn()));
    await waitFor(() => expect(result.current).toBe(false));
    rerender({ ready: false });
    expect(result.current).toBe(false);
  });
  it("does not let a stale count overwrite a read update", async () => {
    let resolve!: (value: { count: number }) => void;
    count.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() => useNotificationBadgePresenter(true));
    act(() => listeners.forEach((fn) => fn()));
    await waitFor(() => expect(count).toHaveBeenCalledTimes(2));
    await act(async () => resolve({ count: 3 }));
    expect(result.current).toBe(false);
  });
});
