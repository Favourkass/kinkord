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

  it("polls only as a slow safety net while the live connection is up", () => {
    live.up = true;
    renderHook(() => useChatListPresenter());
    expect(polls.has(LIST_FALLBACK_POLL_MS)).toBe(true);
    expect(polls.has(LIST_POLL_MS)).toBe(false);
  });
});
