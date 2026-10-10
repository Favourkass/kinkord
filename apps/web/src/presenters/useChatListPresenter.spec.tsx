// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ConversationSummaryPM } from "@/domain/chat";
import { LIST_FALLBACK_POLL_MS, LIST_POLL_MS, useChatListPresenter } from "./useChatListPresenter";

vi.mock("./useHomePresenter", () => ({ useHomePresenter: () => ({}) }));

const polls = new Map<number, () => Promise<void> | void>();
vi.mock("./usePolling", () => ({
  usePolling: (tick: () => Promise<void> | void, ms: number) => polls.set(ms, tick),
}));

// The live connection, driven by hand: each test says when an event arrives.
const live = { up: false, hear: null as null | ((e: unknown) => void) };
vi.mock("./useRealtime", () => ({
  useRealtime: (fn: (e: unknown) => void) => {
    live.hear = fn;
    return { live: live.up };
  },
}));

const list = vi.fn();
const me = vi.fn();
vi.mock("@/services/chat.service", () => ({
  chatService: { list: () => list(), me: () => me() },
}));

const row: ConversationSummaryPM = {
  id: "c1",
  kind: "dm",
  lastMessageAt: "2026-09-28T10:00:00.000Z",
  peer: {
    userId: "u2",
    username: "ada",
    displayName: "Ada",
    avatarUrl: null,
    online: true,
    blockedByMe: false,
  },
  lastMessage: {
    id: "m1",
    conversationId: "c1",
    senderId: "u1",
    body: "see you",
    photo: null,
    createdAt: "2026-09-28T10:00:00.000Z",
    editedAt: null,
  },
  unreadCount: 0,
};

describe("useChatListPresenter", () => {
  beforeEach(() => {
    polls.clear();
    live.up = false;
    list.mockReset().mockResolvedValue([row]);
    me.mockReset().mockResolvedValue({ id: "u1" });
  });
  afterEach(cleanup);

  it("is loading until the first poll lands, then lists threads", async () => {
    const { result } = renderHook(() => useChatListPresenter());
    expect(result.current.list.loading).toBe(true);
    await act(async () => polls.get(LIST_POLL_MS)?.());
    await waitFor(() => expect(result.current.list.rows[0].preview).toBe("You: see you"));
    expect(result.current.list.rows[0].href).toBe("/messages/c1");
    expect(result.current.list.loading).toBe(false);
  });

  it("says the inbox is empty rather than loading forever", async () => {
    list.mockResolvedValue([]);
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_POLL_MS)?.());
    expect(result.current.list.empty).toBe(true);
  });

  it("keeps the last good list when a later poll fails", async () => {
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_POLL_MS)?.());
    list.mockRejectedValueOnce(new Error("offline"));
    await act(async () => polls.get(LIST_POLL_MS)?.());
    expect(result.current.list.rows).toHaveLength(1);
    expect(result.current.list.error).toBeNull();
  });

  it("re-reads the inbox the moment a live event says something changed", async () => {
    renderHook(() => useChatListPresenter());
    list.mockClear();
    await act(async () => live.hear?.({ type: "message", conversationId: "c9" }));
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("ignores inbox events, which never change the chat list", async () => {
    renderHook(() => useChatListPresenter());
    list.mockClear();
    await act(async () => live.hear?.({ type: "notification" }));
    expect(list).not.toHaveBeenCalled();
  });

  it("polls only as a slow safety net while the live connection is up", () => {
    live.up = true;
    renderHook(() => useChatListPresenter());
    expect(polls.has(LIST_FALLBACK_POLL_MS)).toBe(true);
    expect(polls.has(LIST_POLL_MS)).toBe(false);
  });
  it("filters chats and updates unread counts after a refresh", async () => {
    list.mockResolvedValue([
      row,
      {
        ...row,
        id: "c2",
        unreadCount: 3,
        peer: { ...row.peer!, displayName: "Bola", online: false },
      },
    ]);
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_POLL_MS)?.());
    expect(result.current.list.filters.find((f) => f.key === "unread")?.count).toBe("1");
    act(() => result.current.list.setFilter("unread"));
    expect(result.current.list.rows.map((r) => r.id)).toEqual(["c2"]);
    list.mockResolvedValue([row, { ...row, id: "c2", unreadCount: 0 }]);
    await act(async () => live.hear?.({ type: "message", conversationId: "c2" }));
    expect(result.current.list.empty).toBe(true);
    expect(result.current.list.filters.find((f) => f.key === "unread")?.count).toBe("0");
    act(() => {
      result.current.list.setFilter("all");
      result.current.list.setQuery("ADA");
    });
    expect(result.current.list.rows).toHaveLength(2);
    act(() => result.current.list.setQuery("nobody"));
    expect(result.current.list.empty).toBe(true);
  });
  it("updates typing from live events without reloading conversations", async () => {
    live.up = true;
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_FALLBACK_POLL_MS)?.());
    list.mockClear();
    act(() =>
      live.hear?.({
        type: "typing",
        conversationId: "c1",
        typing: true,
        expiresAt: Date.now() + 8000,
      }),
    );
    expect(result.current.list.rows[0].preview).toBe("Is typing…");
    expect(list).not.toHaveBeenCalled();
    act(() =>
      live.hear?.({ type: "typing", conversationId: "c1", typing: false, expiresAt: Date.now() }),
    );
    expect(result.current.list.rows[0].typing).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });
});
