// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ConversationSummaryPM } from "@/domain/chat";
import { LIST_FALLBACK_POLL_MS, LIST_POLL_MS, useChatListPresenter } from "./useChatListPresenter";

vi.mock("./useHomePresenter", () => ({
  useHomePresenter: () => ({ signedIn: true, messagesCount: 9 }),
}));

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
const counts = vi.fn();
const me = vi.fn();
const seen = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/services/chat.service", () => ({
  chatService: {
    seeInbox: () => seen(),
    list: (view?: { q?: string; filter?: string }) => list(view),
    counts: (q?: string) => counts(q),
    me: () => me(),
  },
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
    // Counts from the API are off unless a test turns them on: the loaded chats count.
    counts.mockReset().mockRejectedValue(new Error("offline"));
    me.mockReset().mockResolvedValue({ id: "u1" });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("is loading until the first poll lands, then lists threads", async () => {
    const { result } = renderHook(() => useChatListPresenter());
    expect(result.current.list.loading).toBe(true);
    await act(async () => polls.get(LIST_POLL_MS)?.());
    await waitFor(() => expect(result.current.list.rows[0].preview).toBe("You: see you"));
    expect(result.current.list.rows[0].href).toBe("/messages/c1");
    expect(result.current.list.loading).toBe(false);
  });

  it("marks a chat with the official organization, by its configured id", async () => {
    vi.stubEnv("NEXT_PUBLIC_KINKORD_OFFICIAL_USER_ID", "u2");
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_POLL_MS)?.());
    await waitFor(() => expect(result.current.list.rows).toHaveLength(1));
    expect(result.current.list.rows[0].organization).toBe(true);
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
  it("asks the API to search every chat, and adds the older chats it finds", async () => {
    const older: ConversationSummaryPM = {
      ...row,
      id: "c9",
      lastMessageAt: "2026-08-01T10:00:00.000Z",
      peer: { ...row.peer!, userId: "u9", username: "adaeze", displayName: "Adaeze" },
    };
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_POLL_MS)?.());
    // The API finds Ada's chat too, and an older one the loaded page doesn't hold.
    list.mockClear().mockResolvedValue([row, older]);
    vi.useFakeTimers();
    try {
      act(() => result.current.list.setQuery(" ada "));
      // The loaded chat matches at once, before the API answers.
      expect(result.current.list.rows.map((r) => r.id)).toEqual(["c1"]);
      expect(list).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(list).toHaveBeenCalledWith({ q: "ada", filter: "all" });
      expect(result.current.list.rows.map((r) => r.id)).toEqual(["c1", "c9"]);
      // The next inbox refresh asks again: Adaeze's chat is gone since (a block, say) and drops out.
      list.mockImplementation(async () => [row]);
      await act(async () => polls.get(LIST_POLL_MS)?.());
      expect(list).toHaveBeenLastCalledWith(undefined);
      expect(result.current.list.rows.map((r) => r.id)).toEqual(["c1"]);
      // Clearing the search shows the inbox as it was.
      act(() => result.current.list.setQuery(""));
      expect(result.current.list.rows.map((r) => r.id)).toEqual(["c1"]);
    } finally {
      vi.useRealTimers();
    }
  });
  it("fills a tab from every chat, and counts every chat, once the API answers", async () => {
    const olderUnread: ConversationSummaryPM = {
      ...row,
      id: "c7",
      unreadCount: 2,
      lastMessageAt: "2026-07-01T10:00:00.000Z",
      peer: { ...row.peer!, userId: "u7", username: "tolu", displayName: "Tolu", online: false },
    };
    counts.mockResolvedValue({ all: 73, unread: 4, online: 9 });
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_POLL_MS)?.());
    expect(counts).toHaveBeenCalledWith("");
    await waitFor(() =>
      expect(result.current.list.filters.map((f) => f.count)).toEqual(["73", "4", "9"]),
    );
    list.mockImplementation(async (view?: { filter?: string }) =>
      view?.filter === "unread" ? [olderUnread] : [row],
    );
    act(() => result.current.list.setFilter("unread"));
    await waitFor(() => expect(list).toHaveBeenCalledWith({ q: "", filter: "unread" }));
    // Ada's chat, the newest, has nothing unread; Tolu's older one is found by the API.
    await waitFor(() => expect(result.current.list.rows.map((r) => r.id)).toEqual(["c7"]));
  });
  it("drops a tab's older answer that lands after a newer one", async () => {
    const olderUnread: ConversationSummaryPM = {
      ...row,
      id: "c7",
      unreadCount: 2,
      lastMessageAt: "2026-07-01T10:00:00.000Z",
      peer: { ...row.peer!, userId: "u7", username: "tolu", displayName: "Tolu" },
    };
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_POLL_MS)?.());
    const slow: Array<(items: ConversationSummaryPM[]) => void> = [];
    list.mockImplementation((view?: { filter?: string }) =>
      view?.filter === "unread"
        ? new Promise<ConversationSummaryPM[]>((resolve) => slow.push(resolve))
        : Promise.resolve([row]),
    );
    act(() => result.current.list.setFilter("unread"));
    await waitFor(() => expect(slow).toHaveLength(1));
    // A refresh asks again before the first answer is in.
    await act(async () => polls.get(LIST_POLL_MS)?.());
    expect(slow).toHaveLength(2);
    await act(async () => slow[1]([olderUnread]));
    expect(result.current.list.rows.map((r) => r.id)).toEqual(["c7"]);
    // The first, older answer lands last: it's ignored.
    await act(async () => slow[0]([]));
    expect(result.current.list.rows.map((r) => r.id)).toEqual(["c7"]);
  });
  it("lets the inbox's answer win over a tab answer asked for just before it, in the same moment", async () => {
    const unread = { ...row, unreadCount: 3 };
    list.mockImplementation(async (view?: { filter?: string }) =>
      view?.filter === "unread" ? [unread] : [unread],
    );
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_POLL_MS)?.());
    act(() => result.current.list.setFilter("unread"));
    await waitFor(() => expect(result.current.list.rows.map((r) => r.id)).toEqual(["c1"]));
    vi.useFakeTimers();
    try {
      // The chat is read between the tab's query and the inbox's: both asked in one millisecond.
      list.mockImplementation(async (view?: { filter?: string }) =>
        view?.filter === "unread" ? [unread] : [{ ...row, unreadCount: 0 }],
      );
      await act(async () => polls.get(LIST_POLL_MS)?.());
      expect(result.current.list.rows).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
  it("updates typing from live events without reloading conversations", async () => {
    live.up = true;
    const { result } = renderHook(() => useChatListPresenter());
    await act(async () => polls.get(LIST_FALLBACK_POLL_MS)?.());
    list.mockClear();
    act(() => live.hear?.({ type: "typing", conversationId: "c1", typing: true }));
    expect(result.current.list.rows[0].preview).toBe("Is typing…");
    expect(list).not.toHaveBeenCalled();
    act(() => live.hear?.({ type: "typing", conversationId: "c1", typing: false }));
    expect(result.current.list.rows[0].typing).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });
});

it("clears only the navigation badge on inbox entry while retaining unread chats and filters", async () => {
  const unread = { ...row, unreadCount: 3 };
  list.mockResolvedValue([unread]);
  counts.mockResolvedValue({ all: 1, unread: 1, online: 1 });
  const { result } = renderHook(() => useChatListPresenter());
  expect(result.current.shell.messagesCount).toBe(0);
  await waitFor(() => expect(seen).toHaveBeenCalled());
  await act(async () => {
    for (const tick of polls.values()) await tick();
  });
  await waitFor(() => expect(result.current.list.rows[0]?.unread).toBe(3));
  expect(result.current.list.filters.find((f) => f.key === "unread")?.count).toBe("1");
});
