// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useNotificationsPresenter } from "./useNotificationsPresenter";
import type { NotificationPM } from "@/domain/notification";
const { list, read, readAll, push, replace } = vi.hoisted(() => ({
  list: vi.fn(),
  read: vi.fn(),
  readAll: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));
const router = { push, replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/notifications.service", async (original) => ({
  ...(await original<typeof import("@/services/notifications.service")>()),
  notificationsApi: { list, read, readAll },
  listenForInboxChanges: () => () => undefined,
}));
const item: NotificationPM = {
  id: "n1",
  type: "message",
  title: "Kinkord",
  body: "New message from Ada",
  url: "/messages/c1",
  createdAt: "2026-10-03T10:00:00Z",
  readAt: null,
};
afterEach(cleanup);
beforeEach(() => {
  list.mockReset().mockResolvedValue({ items: [item], nextCursor: null });
  read.mockReset().mockResolvedValue({ ...item, readAt: item.createdAt });
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
    await waitFor(() => expect(list).toHaveBeenCalledWith(true, null));
    list.mockResolvedValue({ items: [], nextCursor: null });
    await act(async () => result.current.markAll());
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(readAll).toHaveBeenCalledTimes(1);
  });
  it("fetches category tabs from the API and searches the results", async () => {
    const { result } = renderHook(() => useNotificationsPresenter(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setTab("comment"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(false, null, "comment"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setQuery("no match"));
    expect(result.current.items).toHaveLength(0);
    act(() => result.current.setTab("mention"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(false, null, "mention"));
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
    expect(list).toHaveBeenLastCalledWith(false, "next");
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
});
