// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { CHAT_COPY } from "@/constants/chat";
import type { ChatMessagePM, ConversationSummaryPM } from "@/domain/chat";
import { ApiError } from "@/services/apiClient";
import { useMessageActions } from "./useMessageActions";

const svc = {
  edit: vi.fn(),
  remove: vi.fn(),
  forward: vi.fn(),
  copy: vi.fn(),
  list: vi.fn(),
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

const NOW = new Date("2026-09-28T10:05:00.000Z");
const msg = (id: string, senderId: string, over: Partial<ChatMessagePM> = {}): ChatMessagePM => ({
  id,
  conversationId: "c1",
  senderId,
  body: `message ${id}`,
  photo: null,
  createdAt: "2026-09-28T10:00:00.000Z",
  editedAt: null,
  ...over,
});
const chat = (id: string): ConversationSummaryPM => ({
  id,
  kind: "dm",
  lastMessageAt: "2026-09-28T10:00:00.000Z",
  peer: {
    userId: `p-${id}`,
    username: id,
    displayName: `Member ${id}`,
    avatarUrl: null,
    online: false,
    blockedByMe: false,
  },
  lastMessage: null,
  unreadCount: 0,
});

/** The hook with the thread's messages beside it, as the thread presenter holds them. */
function mount(initial: ChatMessagePM[] = [msg("m1", "u2"), msg("m2", "u1")]) {
  return renderHook(() => {
    const [messages, setMessages] = useState(initial);
    const actions = useMessageActions({
      conversationId: "c1",
      messages,
      viewerId: "u1",
      setMessages,
    });
    return { messages, actions };
  });
}

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  svc.list.mockResolvedValue([]);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useMessageActions", () => {
  it("opens the menu only for a message the thread has, as of the moment it opens", () => {
    const { result } = mount();
    act(() => result.current.actions.open("gone"));
    expect(result.current.actions.sheet).toBeNull();
    act(() => result.current.actions.open("m2"));
    expect(result.current.actions.sheet?.items.map((i) => i.key)).toContain("edit");
    // Twenty minutes later the same message can't be edited any more.
    act(() => result.current.actions.sheet?.onClose());
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60_000));
    act(() => result.current.actions.open("m2"));
    expect(result.current.actions.sheet?.items.map((i) => i.key)).not.toContain("edit");
  });

  it("won't close while a deletion is on its way, then shows the result", async () => {
    let finish: (v: unknown) => void = () => undefined;
    svc.remove.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = mount();
    act(() => result.current.actions.open("m2"));
    act(() => result.current.actions.sheet?.onSelect("delete"));
    act(() => result.current.actions.sheet?.onSelect("everyone"));
    expect(result.current.actions.sheet?.busy).toBe(true);
    act(() => result.current.actions.sheet?.onClose());
    expect(result.current.actions.sheet).not.toBeNull();
    await act(async () =>
      finish({ message: msg("m2", "u1", { body: "", deletedAt: NOW.toISOString() }) }),
    );
    expect(result.current.actions.sheet).toBeNull();
    expect(result.current.messages.find((m) => m.id === "m2")?.deletedAt).toBe(NOW.toISOString());
  });

  it("keeps the delete choice open, saying why, when the server refuses", async () => {
    svc.remove.mockRejectedValue(
      new ApiError(400, {
        message: "Messages can only be deleted for everyone within 48 hours of sending.",
      }),
    );
    const { result } = mount();
    act(() => result.current.actions.open("m2"));
    act(() => result.current.actions.sheet?.onSelect("delete"));
    await act(async () => result.current.actions.sheet?.onSelect("everyone"));
    expect(result.current.actions.sheet?.error).toBe(
      "Messages can only be deleted for everyone within 48 hours of sending.",
    );
    expect(result.current.messages.find((m) => m.id === "m2")?.deletedAt).toBeUndefined();
  });

  it("lets five chats be chosen, no more", async () => {
    svc.list.mockResolvedValue(["c2", "c3", "c4", "c5", "c6", "c7"].map(chat));
    const { result } = mount();
    act(() => result.current.actions.open("m1"));
    act(() => result.current.actions.sheet?.onSelect("forward"));
    await waitFor(() => expect(result.current.actions.forwardSheet?.loading).toBe(false));
    for (const id of ["c2", "c3", "c4", "c5", "c6", "c7"]) {
      act(() => result.current.actions.forwardSheet?.onToggle(id));
    }
    const chats = result.current.actions.forwardSheet?.chats ?? [];
    expect(chats.filter((c) => c.selected).map((c) => c.id)).toEqual([
      "c2",
      "c3",
      "c4",
      "c5",
      "c6",
    ]);
    expect(chats.find((c) => c.id === "c7")?.disabled).toBe(true);
    expect(result.current.actions.forwardSheet?.chosenLabel).toBe("5 of 5 chosen");
  });

  it("searches the forward picker, and says so when the chats can't be loaded", async () => {
    const { result } = mount();
    act(() => result.current.actions.open("m1"));
    act(() => result.current.actions.sheet?.onSelect("forward"));
    await waitFor(() => expect(result.current.actions.forwardSheet?.loading).toBe(false));
    expect(svc.list).toHaveBeenLastCalledWith({ q: "" });
    svc.list.mockRejectedValueOnce(new ApiError(500, { message: "Server error" }));
    act(() => result.current.actions.forwardSheet?.onQuery("bo"));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(svc.list).toHaveBeenLastCalledWith({ q: "bo" });
    expect(result.current.actions.forwardSheet?.error).toBe("Server error");
    expect(result.current.actions.forwardSheet?.chats).toEqual([]);
  });

  it("shows a copy forwarded into this same chat at once", async () => {
    svc.list.mockResolvedValue([chat("c1")]);
    const copy = msg("m9", "u1", { createdAt: "2026-09-28T10:04:00.000Z", forwarded: true });
    svc.forward.mockResolvedValue([{ conversationId: "c1", message: copy, error: null }]);
    const { result } = mount();
    act(() => result.current.actions.open("m1"));
    act(() => result.current.actions.sheet?.onSelect("forward"));
    await waitFor(() => expect(result.current.actions.forwardSheet?.loading).toBe(false));
    act(() => result.current.actions.forwardSheet?.onToggle("c1"));
    await act(async () => result.current.actions.forwardSheet?.onSend());
    expect(result.current.messages.map((m) => m.id)).toEqual(["m1", "m2", "m9"]);
    expect(result.current.actions.notice).toBe("Forwarded to 1 chat.");
  });

  it("says when copying isn't possible, and the note clears itself", async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    svc.copy.mockRejectedValue(new Error("Copying isn't available here."));
    const { result } = mount();
    act(() => result.current.actions.open("m1"));
    await act(async () => result.current.actions.sheet?.onSelect("copy"));
    expect(result.current.actions.notice).toBe("Copying isn't available here.");
    act(() => vi.advanceTimersByTime(2_500));
    expect(result.current.actions.notice).toBeNull();
    expect(CHAT_COPY.message.copied).toBe("Copied");
  });
});
