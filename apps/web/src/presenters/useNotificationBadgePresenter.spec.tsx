// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  BADGE_FALLBACK_POLL_MS,
  BADGE_POLL_MS,
  useNotificationBadgePresenter,
} from "./useNotificationBadgePresenter";
const { count, listeners, live } = vi.hoisted(() => ({
  count: vi.fn(),
  listeners: new Set<() => void>(),
  live: { on: false, hear: null as ((e: unknown) => void) | null, enabled: [] as boolean[] },
}));
vi.mock("@/services/notifications.service", () => ({
  notificationsApi: { unreadCount: count },
  listenForInboxChanges: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
}));
vi.mock("./useRealtime", () => ({
  useRealtime: (fn: (e: unknown) => void, enabled = true) => {
    live.enabled.push(enabled);
    if (enabled) live.hear = fn;
    return { live: enabled && live.on };
  },
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  count.mockReset().mockResolvedValue({ count: 0 });
  listeners.clear();
  live.on = false;
  live.hear = null;
  live.enabled = [];
});
describe("notification badge", () => {
  it("does not ask for a badge, or open a live connection, before sign-in", () => {
    renderHook(() => useNotificationBadgePresenter(false));
    expect(count).not.toHaveBeenCalled();
    expect(live.enabled.every((e) => e === false)).toBe(true);
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
  it("lights up as soon as a live event says something new arrived", async () => {
    const { result } = renderHook(() => useNotificationBadgePresenter(true));
    await waitFor(() => expect(count).toHaveBeenCalledTimes(1));
    count.mockResolvedValueOnce({ count: 1 });
    act(() => live.hear?.({ type: "message", conversationId: "c1" }));
    expect(count).toHaveBeenCalledTimes(1);
    act(() => live.hear?.({ type: "notification" }));
    await waitFor(() => expect(result.current).toBe(true));
  });
  it("checks every minute while live events can't arrive", async () => {
    vi.useFakeTimers();
    renderHook(() => useNotificationBadgePresenter(true));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    const first = count.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(BADGE_POLL_MS));
    expect(count.mock.calls.length).toBe(first + 1);
  });
  it("only checks every few minutes while they do", async () => {
    vi.useFakeTimers();
    live.on = true;
    renderHook(() => useNotificationBadgePresenter(true));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    const first = count.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(BADGE_POLL_MS));
    expect(count.mock.calls.length).toBe(first);
    await act(async () => vi.advanceTimersByTimeAsync(BADGE_FALLBACK_POLL_MS - BADGE_POLL_MS));
    expect(count.mock.calls.length).toBe(first + 1);
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
