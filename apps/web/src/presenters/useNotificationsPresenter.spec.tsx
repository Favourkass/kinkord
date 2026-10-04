// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useNotificationsPresenter } from "./useNotificationsPresenter";
import type { NotificationPM } from "@/domain/notification";
const { counts, list, read, readAll, push, replace, remove } = vi.hoisted(() => ({
  counts: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  readAll: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  remove: vi.fn(),
}));
const router = { push, replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/notifications.service", async (original) => ({
  ...(await original<typeof import("@/services/notifications.service")>()),
  notificationsApi: {
    list,
    read,
    readAll,
    delete: remove,
    counts,
  },
  listenForInboxChanges: () => () => undefined,
}));
// Live events, delivered by hand: `hear` is whatever the screen subscribed.
const live = vi.hoisted(() => ({ hear: null as ((e: unknown) => void) | null }));
vi.mock("./useRealtime", () => ({
  useRealtime: (fn: (e: unknown) => void, enabled = true) => {
    if (enabled) live.hear = fn;
    return { live: false };
  },
}));
const item: NotificationPM = {
  id: "n1",
  type: "message",
  actor: { name: "Ada", username: "ada", avatarUrl: null },
  url: "/messages/c1",
  count: 1,
  createdAt: "2026-10-03T10:00:00Z",
  readAt: null,
};
const page = (over: Record<string, unknown> = {}) => ({
  unread: false,
  cursor: null,
  type: undefined,
  q: undefined,
  ...over,
});
afterEach(cleanup);
beforeEach(() => {
  counts.mockReset().mockResolvedValue({ all: 9, comment: 2, mention: 3 });
  list.mockReset().mockResolvedValue({ items: [item], nextCursor: null });
  read.mockReset().mockImplementation(async () => {
    const updated = { ...item, readAt: item.createdAt };
    list.mockResolvedValue({ items: [updated], nextCursor: null });
    return updated;
  });
  readAll.mockReset().mockResolvedValue(undefined);
  push.mockClear();
  replace.mockClear();
});
describe("useNotificationsPresenter", () => {
  it("waits for an authenticated screen before loading", async () => {
    const { result, rerender } = renderHook(({ ready }) => useNotificationsPresenter(ready), {
      initialProps: { ready: false },
    });
    expect(list).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    rerender({ ready: true });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
  });
  it("marks a clicked notification read before navigating", async () => {
    let resolve!: (value: NotificationPM) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      void result.current.openNotification("n1");
    });
    expect(push).not.toHaveBeenCalled();
    expect(result.current.opening).toBe("n1");
    list.mockResolvedValue({ items: [{ ...item, readAt: item.createdAt }], nextCursor: null });
    await act(async () => resolve({ ...item, readAt: item.createdAt }));
    expect(push).toHaveBeenCalledWith("/messages/c1");
    expect(result.current.items[0].unread).toBe(false);
  });
  it("retains unread state and does not navigate when marking fails", async () => {
    read.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.openNotification("n1"));
    expect(result.current.items[0].unread).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/mark/);
  });
  it("filters unread items and marks all, including unseen pages", async () => {
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setUnreadOnly(true));
    await waitFor(() => expect(list).toHaveBeenCalledWith(page({ unread: true })));
    list.mockResolvedValue({ items: [], nextCursor: null });
    await act(async () => result.current.markAll());
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(readAll).toHaveBeenCalledTimes(1);
  });
  it("fetches category tabs from the API and searches the results", async () => {
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setTab("comment"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(page({ type: "comment" })));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // The search goes to the server once typing pauses, within the open tab.
    list.mockResolvedValue({ items: [], nextCursor: null });
    act(() => result.current.setQuery(" raven "));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(page({ type: "comment", q: "raven" })),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(0);
    act(() => result.current.setQuery(""));
    act(() => result.current.setTab("mention"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(page({ type: "mention" })));
  });
  it("marks read from the row menu without leaving the inbox", async () => {
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setMenuId("n1"));
    await act(async () => result.current.markRead("n1"));
    expect(result.current.menuId).toBeNull();
    expect(result.current.items[0].unread).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
  it("loads more without duplicating rows", async () => {
    list.mockResolvedValueOnce({ items: [item], nextCursor: "next" });
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    list.mockResolvedValueOnce({ items: [item, { ...item, id: "n2" }], nextCursor: null });
    await act(async () => result.current.loadMore());
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
    expect(list).toHaveBeenLastCalledWith(page({ cursor: "next" }));
  });
  it("refreshes older loaded pages so another device's reads clear their dots", async () => {
    const older = { ...item, id: "older" };
    list.mockResolvedValueOnce({ items: [item], nextCursor: "next" });
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    list.mockResolvedValueOnce({ items: [older], nextCursor: null });
    await act(async () => result.current.loadMore());
    list.mockResolvedValueOnce({ items: [item], nextCursor: "next" });
    list.mockResolvedValueOnce({ items: [{ ...older, readAt: item.createdAt }], nextCursor: null });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() =>
      expect(result.current.items.find((row) => row.id === "older")?.unread).toBe(false),
    );
    expect(result.current.items).toHaveLength(2);
  });

  it("opens an OS notification even when it is not in the current page", async () => {
    renderHook(() => useNotificationsPresenter(true, "older"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/messages/c1"));
    expect(read).toHaveBeenCalledWith("older");
  });
  it("does not navigate to an unsafe URL returned by the API", async () => {
    read.mockResolvedValueOnce({ ...item, url: "javascript:alert(1)", readAt: item.createdAt });
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.openNotification("n1"));
    expect(push).toHaveBeenCalledWith("/notifications");
  });
  it("ignores a late response from the previous filter", async () => {
    let resolve!: (value: unknown) => void;
    list.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    list.mockResolvedValueOnce({ items: [], nextCursor: null });
    const { result } = renderHook(() => useNotificationsPresenter(true));
    act(() => result.current.setUnreadOnly(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => resolve({ items: [item], nextCursor: null }));
    expect(result.current.items).toHaveLength(0);
  });

  it("refreshes when the inbox changes elsewhere, and ignores chat events", async () => {
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const calls = list.mock.calls.length;
    act(() => live.hear?.({ type: "message", conversationId: "c1" }));
    expect(list).toHaveBeenCalledTimes(calls);
    act(() => live.hear?.({ type: "notification" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(calls + 1));
  });
});

it("removes a deleted item and keeps it after a failed deletion", async () => {
  remove.mockRejectedValueOnce(new Error("offline"));
  const { result } = renderHook(() => useNotificationsPresenter(true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.deleteNotification("n1"));
  expect(result.current.items).toHaveLength(1);
  expect(result.current.error).toContain("delete");
  remove.mockResolvedValueOnce({ id: "n1" });
  list.mockResolvedValue({ items: [], nextCursor: null });
  await act(async () => result.current.deleteNotification("n1"));
  await waitFor(() => expect(result.current.items).toHaveLength(0));
});

describe("unread tab badges", () => {
  it("requests unread totals while the list still includes read notifications", async () => {
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(counts).toHaveBeenCalledWith(true);
    expect(result.current.unreadOnly).toBe(false);
    expect(result.current.tabCounts).toEqual({ all: 9, comment: 2, mention: 3 });
    act(() => result.current.setTab("comment"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(counts.mock.calls.every(([unread]) => unread === true)).toBe(true);
  });

  it.each([
    ["comment", { all: 8, comment: 1, mention: 3 }],
    ["mention", { all: 8, comment: 2, mention: 2 }],
    ["follow", { all: 8, comment: 2, mention: 3 }],
  ] as const)(
    "reduces the matching unread badges for %s once after reading",
    async (type, expected) => {
      const notification = { ...item, type };
      const readNotification = { ...notification, readAt: item.createdAt };
      list.mockResolvedValue({ items: [notification], nextCursor: null });
      read.mockResolvedValue(readNotification);
      const { result } = renderHook(() => useNotificationsPresenter(true));
      await waitFor(() => expect(result.current.loading).toBe(false));
      // Hold the server refresh to verify the immediate update independently.
      counts.mockImplementationOnce(() => new Promise(() => undefined));
      list.mockResolvedValue({ items: [readNotification], nextCursor: null });
      await act(async () => result.current.markRead(item.id));
      expect(result.current.tabCounts).toEqual(expected);
      expect(result.current.items[0].unread).toBe(false);
      counts.mockResolvedValue(expected);
      await act(async () => result.current.markRead(item.id));
      expect(result.current.tabCounts).toEqual(expected);
    },
  );

  it("keeps unread badges when a read fails", async () => {
    read.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.markRead(item.id));
    expect(result.current.tabCounts).toEqual({ all: 9, comment: 2, mention: 3 });
  });

  it("clears all badges after marking the whole inbox read", async () => {
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    counts.mockImplementationOnce(() => new Promise(() => undefined));
    await act(async () => result.current.markAll());
    expect(result.current.tabCounts).toEqual({ all: 0, comment: 0, mention: 0 });
  });

  it("refreshes unread badges for reads on another device and deletions", async () => {
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    counts.mockResolvedValue({ all: 4, comment: 1, mention: 1 });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.tabCounts.all).toBe(4));
    remove.mockResolvedValueOnce({ id: item.id });
    list.mockResolvedValue({ items: [], nextCursor: null });
    counts.mockResolvedValue({ all: 3, comment: 0, mention: 1 });
    await act(async () => result.current.deleteNotification(item.id));
    await waitFor(() =>
      expect(result.current.tabCounts).toEqual({ all: 3, comment: 0, mention: 1 }),
    );
  });
});
