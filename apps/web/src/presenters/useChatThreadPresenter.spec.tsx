// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ChatMessagePM, ConversationSummaryPM } from "@/domain/chat";
import { THREAD_POLL_MS, useChatThreadPresenter } from "./useChatThreadPresenter";

vi.mock("./useHomePresenter", () => ({ useHomePresenter: () => ({}) }));

// usePolling is driven by hand here, so each test decides when a poll happens.
const polls = new Map<number, { tick: () => Promise<void> | void; enabled: boolean }>();
vi.mock("./usePolling", () => ({
  usePolling: (tick: () => Promise<void> | void, ms: number, enabled: boolean) =>
    polls.set(ms, { tick, enabled }),
}));

const svc = {
  me: vi.fn(),
  conversation: vi.fn(),
  history: vi.fn(),
  send: vi.fn(),
  markRead: vi.fn(),
};
vi.mock("@/services/chat.service", () => ({
  chatService: new Proxy(
    {},
    {
      get:
        (_t, name: string) =>
        (...a: unknown[]) =>
          svc[name as keyof typeof svc](...a),
    },
  ),
}));

const msg = (id: string, senderId: string, second: number): ChatMessagePM => ({
  id,
  conversationId: "c1",
  senderId,
  body: `message ${id}`,
  createdAt: `2026-09-28T10:00:${String(second).padStart(2, "0")}.000Z`,
  editedAt: null,
});

const header = (over: Partial<ConversationSummaryPM> = {}): ConversationSummaryPM => ({
  id: "c1",
  kind: "dm",
  lastMessageAt: "2026-09-28T10:00:00.000Z",
  peer: { userId: "u2", username: "ada", displayName: "Ada", avatarUrl: null, online: false },
  lastMessage: null,
  unreadCount: 0,
  ...over,
});

async function ready() {
  const hook = renderHook(() => useChatThreadPresenter("c1"));
  await waitFor(() => expect(hook.result.current.thread.loading).toBe(false));
  return hook;
}

describe("useChatThreadPresenter", () => {
  beforeEach(() => {
    polls.clear();
    Object.values(svc).forEach((f) => f.mockReset());
    svc.me.mockResolvedValue({ id: "u1" });
    svc.conversation.mockResolvedValue(header());
    svc.history.mockResolvedValue([msg("m1", "u2", 1), msg("m2", "u1", 2)]);
    svc.markRead.mockResolvedValue({ ok: true });
  });
  afterEach(cleanup);

  it("loads the thread and tells the viewer's bubbles apart", async () => {
    const { result } = await ready();
    expect(result.current.thread.peer?.displayName).toBe("Ada");
    expect(result.current.thread.messages.map((m) => [m.id, m.isOwn])).toEqual([
      ["m1", false],
      ["m2", true],
    ]);
    expect(result.current.thread.hasMore).toBe(false);
  });

  it("polls for what's newer than the last message and marks it read", async () => {
    const { result } = await ready();
    expect(polls.get(THREAD_POLL_MS)?.enabled).toBe(true);
    svc.history.mockResolvedValueOnce([msg("m3", "u2", 3)]);
    await act(async () => polls.get(THREAD_POLL_MS)?.tick());

    expect(svc.history).toHaveBeenLastCalledWith("c1", { after: "m2" });
    expect(result.current.thread.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    await waitFor(() => expect(svc.markRead).toHaveBeenLastCalledWith("c1", "m3"));
  });

  it("shows a sent message at once and swaps in the saved one", async () => {
    let confirm: (m: unknown) => void = () => undefined;
    svc.send.mockImplementation(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    const { result } = await ready();
    act(() => result.current.send("  hi there  "));
    const bubble = result.current.thread.messages[2];
    expect(bubble).toMatchObject({ body: "hi there", status: "sending", isOwn: true });
    expect(svc.send).toHaveBeenCalledWith("c1", "hi there", bubble.clientId);

    await act(async () => confirm({ ...msg("m9", "u1", 9), clientId: bubble.clientId }));
    expect(result.current.thread.messages.map((m) => [m.id, m.status])).toEqual([
      ["m1", "sent"],
      ["m2", "sent"],
      ["m9", "sent"],
    ]);
  });

  it("keeps a refused message for a retry and says why", async () => {
    svc.send.mockRejectedValueOnce(new Error("You're sending messages too fast. Wait a moment."));
    const { result } = await ready();
    act(() => result.current.send("hi"));
    await waitFor(() => expect(result.current.thread.messages[2].status).toBe("failed"));
    expect(result.current.thread.sendError).toBe(
      "You're sending messages too fast. Wait a moment.",
    );

    svc.send.mockResolvedValueOnce({ ...msg("m9", "u1", 9), clientId: "x" });
    const clientId = result.current.thread.messages[2].clientId as string;
    act(() => result.current.retry(clientId));
    await waitFor(() => expect(result.current.thread.messages[2].id).toBe("m9"));
    expect(result.current.thread.sendError).toBeNull();
  });

  it("pages back from the oldest message it has", async () => {
    svc.history.mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, i) => msg(`n${i + 10}`, "u2", i + 10)),
    );
    const { result } = await ready();
    expect(result.current.thread.hasMore).toBe(true);
    svc.history.mockResolvedValueOnce([msg("old", "u2", 1)]);
    await act(async () => result.current.loadMore());
    expect(svc.history).toHaveBeenLastCalledWith("c1", { before: "n10" });
    expect(result.current.thread.messages[0].id).toBe("old");
    expect(result.current.thread.hasMore).toBe(false);
  });

  it("goes read-only when the other member is gone", async () => {
    svc.conversation.mockResolvedValue(header({ peer: null }));
    const { result } = await ready();
    expect(result.current.thread.unavailable).toBe(true);
  });

  it("says so when the thread can't be opened, and doesn't poll", async () => {
    svc.conversation.mockRejectedValue(new Error("Conversation not found."));
    const { result } = await ready();
    expect(result.current.thread.error).toBe("Conversation not found.");
    expect(polls.get(THREAD_POLL_MS)?.enabled).toBe(false);
  });
});
