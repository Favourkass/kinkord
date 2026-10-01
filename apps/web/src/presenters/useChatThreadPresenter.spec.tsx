// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { CHAT_COPY, photosLockedText } from "@/constants/chat";
import type { ChatMessagePM, ConversationThreadPM } from "@/domain/chat";
import { ApiError } from "@/services/apiClient";
import {
  THREAD_FALLBACK_POLL_MS,
  THREAD_POLL_MS,
  useChatThreadPresenter,
} from "./useChatThreadPresenter";

vi.mock("./useHomePresenter", () => ({ useHomePresenter: () => ({}) }));

// usePolling is driven by hand here, so each test decides when a poll happens.
const polls = new Map<number, { tick: () => Promise<void> | void; enabled: boolean }>();
vi.mock("./usePolling", () => ({
  usePolling: (tick: () => Promise<void> | void, ms: number, enabled: boolean) =>
    polls.set(ms, { tick, enabled }),
}));

// The live connection, driven by hand: each test says when an event arrives.
const live = { up: false, hear: null as null | ((e: unknown) => void) };
vi.mock("./useRealtime", () => ({
  useRealtime: (fn: (e: unknown) => void) => {
    live.hear = fn;
    return { live: live.up };
  },
}));

// Blocking goes through the safety service; here it just succeeds.
const safety = { block: vi.fn(), unblock: vi.fn(), report: vi.fn() };
vi.mock("@/services/safety.service", () => ({
  safetyService: {
    block: (...a: unknown[]) => safety.block(...a),
    unblock: (...a: unknown[]) => safety.unblock(...a),
    report: (...a: unknown[]) => safety.report(...a),
  },
}));

const svc = {
  me: vi.fn(),
  conversation: vi.fn(),
  history: vi.fn(),
  send: vi.fn(),
  markRead: vi.fn(),
  allowance: vi.fn(),
  uploadPhoto: vi.fn(),
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
  photo: null,
  createdAt: `2026-09-28T10:00:${String(second).padStart(2, "0")}.000Z`,
  editedAt: null,
});

const header = (over: Partial<ConversationThreadPM> = {}): ConversationThreadPM => ({
  id: "c1",
  kind: "dm",
  lastMessageAt: "2026-09-28T10:00:00.000Z",
  peer: {
    userId: "u2",
    username: "ada",
    displayName: "Ada",
    avatarUrl: null,
    online: false,
    blockedByMe: false,
  },
  lastMessage: null,
  unreadCount: 0,
  canSendPhotos: false,
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
    live.up = false;
    Object.values(svc).forEach((f) => f.mockReset());
    svc.me.mockResolvedValue({ id: "u1" });
    svc.conversation.mockResolvedValue(header());
    svc.history.mockResolvedValue([msg("m1", "u2", 1), msg("m2", "u1", 2)]);
    svc.markRead.mockResolvedValue({ ok: true });
    svc.allowance.mockResolvedValue({
      newChatsPerDay: 1,
      usedToday: 0,
      resetsAt: "2026-09-30T23:00:00.000Z",
    });
    // jsdom has no object URLs; a picked photo's local preview is stood in for.
    URL.createObjectURL = vi.fn(() => "blob:local-photo");
    URL.revokeObjectURL = vi.fn();
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
    // Text only: no photo key goes with it.
    expect(svc.send).toHaveBeenCalledWith("c1", "hi there", bubble.clientId, undefined);

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

  describe("the daily new-chat allowance", () => {
    it("hints that a first message here uses today's new chat", async () => {
      svc.history.mockResolvedValue([]);
      const { result } = await ready();
      await waitFor(() =>
        expect(result.current.thread.newChat).toEqual({
          text: CHAT_COPY.newChatHint,
          blocking: false,
        }),
      );
    });

    it("replaces the composer with a notice once today's new chat is used", async () => {
      svc.history.mockResolvedValue([]);
      svc.allowance.mockResolvedValue({
        newChatsPerDay: 1,
        usedToday: 1,
        resetsAt: "2026-09-30T23:00:00.000Z",
      });
      const { result } = await ready();
      await waitFor(() =>
        expect(result.current.thread.newChat).toEqual({
          text: CHAT_COPY.newChatLimit,
          blocking: true,
        }),
      );
    });

    it("says nothing to members without a limit", async () => {
      svc.history.mockResolvedValue([]);
      svc.allowance.mockResolvedValue({ newChatsPerDay: null });
      const { result } = await ready();
      await waitFor(() => expect(svc.allowance).toHaveBeenCalled());
      expect(result.current.thread.newChat).toBeNull();
    });

    it("doesn't ask in a thread that already has messages: replies aren't limited", async () => {
      const { result } = await ready();
      expect(svc.allowance).not.toHaveBeenCalled();
      expect(result.current.thread.newChat).toBeNull();
    });

    it("drops the hint once the first message is on its way", async () => {
      svc.history.mockResolvedValue([]);
      svc.send.mockReturnValue(new Promise(() => {}));
      const { result } = await ready();
      await waitFor(() => expect(result.current.thread.newChat?.blocking).toBe(false));
      act(() => result.current.send("hi"));
      expect(result.current.thread.newChat).toBeNull();
    });

    it("turns a first message the server refuses into the notice, not a retry", async () => {
      svc.history.mockResolvedValue([]);
      svc.send.mockRejectedValueOnce(
        new ApiError(429, { code: "NEW_CHAT_LIMIT", message: "Already used today." }),
      );
      const { result } = await ready();
      act(() => result.current.send("hi"));
      await waitFor(() => expect(result.current.thread.newChat?.blocking).toBe(true));
      expect(result.current.thread.messages).toEqual([]);
      expect(result.current.thread.sendError).toBeNull();
    });
  });

  describe("live delivery", () => {
    it("fetches what's new the moment a live event names this thread", async () => {
      const { result } = await ready();
      svc.history.mockResolvedValueOnce([msg("m3", "u2", 3)]);
      await act(async () => live.hear?.({ type: "message", conversationId: "c1" }));
      expect(svc.history).toHaveBeenLastCalledWith("c1", { after: "m2" });
      expect(result.current.thread.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    });

    it("ignores events for other threads", async () => {
      await ready();
      const calls = svc.history.mock.calls.length;
      await act(async () => live.hear?.({ type: "message", conversationId: "c9" }));
      expect(svc.history.mock.calls.length).toBe(calls);
    });

    it("polls only as a slow safety net while the live connection is up", async () => {
      live.up = true;
      await ready();
      expect(polls.has(THREAD_FALLBACK_POLL_MS)).toBe(true);
      expect(polls.has(THREAD_POLL_MS)).toBe(false);
    });
  });

  describe("photos", () => {
    const photoFile = () => new File(["x"], "p.jpg", { type: "image/jpeg" });
    const theirPhoto = {
      previewUrl: "https://media/p_sm.jpg",
      thumbUrl: "https://media/p_md.jpg",
      url: "https://media/p.jpg",
    };

    it("won't attach one before the other member has written, and says why", async () => {
      const { result } = await ready();
      expect(result.current.composerPhoto.allowed).toBe(false);
      expect(result.current.thread.photoNotice).toBeNull();
      act(() => result.current.attachPhoto(photoFile()));
      expect(svc.uploadPhoto).not.toHaveBeenCalled();
      expect(result.current.composerPhoto.draft).toBeNull();
      expect(result.current.thread.photoNotice).toBe(photosLockedText("Ada"));
    });

    it("uploads a picked photo at once, and sends it with the caption once it's ready", async () => {
      svc.conversation.mockResolvedValue(header({ canSendPhotos: true }));
      let uploaded: (key: string) => void = () => undefined;
      svc.uploadPhoto.mockImplementation(
        () =>
          new Promise((resolve) => {
            uploaded = resolve;
          }),
      );
      svc.send.mockImplementation(() => new Promise(() => undefined));
      const { result } = await ready();

      const file = photoFile();
      act(() => result.current.attachPhoto(file));
      expect(svc.uploadPhoto).toHaveBeenCalledWith("c1", file);
      expect(result.current.composerPhoto.draft).toEqual({
        previewUrl: "blob:local-photo",
        uploading: true,
        error: null,
      });
      // Still uploading: Send waits for it.
      act(() => result.current.send("look"));
      expect(svc.send).not.toHaveBeenCalled();

      await act(async () => uploaded("chat/c1/u1/p.jpg"));
      expect(result.current.composerPhoto.draft).toMatchObject({ uploading: false, error: null });
      act(() => result.current.send("look"));
      const bubble = result.current.thread.messages[2];
      expect(svc.send).toHaveBeenCalledWith("c1", "look", bubble.clientId, "chat/c1/u1/p.jpg");
      expect(bubble).toMatchObject({
        body: "look",
        status: "sending",
        photo: { src: "blob:local-photo", hidden: false },
      });
      expect(result.current.composerPhoto.draft).toBeNull();
    });

    it("sends a photo with no caption", async () => {
      svc.conversation.mockResolvedValue(header({ canSendPhotos: true }));
      svc.uploadPhoto.mockResolvedValue("chat/c1/u1/p.jpg");
      svc.send.mockImplementation(() => new Promise(() => undefined));
      const { result } = await ready();
      act(() => result.current.attachPhoto(photoFile()));
      await waitFor(() => expect(result.current.composerPhoto.draft?.uploading).toBe(false));
      act(() => result.current.send("   "));
      expect(svc.send).toHaveBeenCalledWith("c1", "", expect.any(String), "chat/c1/u1/p.jpg");
    });

    it("says why an upload failed, and lets the member take the photo off", async () => {
      svc.conversation.mockResolvedValue(header({ canSendPhotos: true }));
      svc.uploadPhoto.mockRejectedValue(
        new ApiError(400, { message: "Photo is too large — max 10MB." }),
      );
      const { result } = await ready();
      act(() => result.current.attachPhoto(photoFile()));
      await waitFor(() =>
        expect(result.current.composerPhoto.draft?.error).toBe("Photo is too large — max 10MB."),
      );
      act(() => result.current.send("look"));
      expect(svc.send).not.toHaveBeenCalled();
      act(() => result.current.removePhoto());
      expect(result.current.composerPhoto.draft).toBeNull();
    });

    it("says a generic sorry when the upload fails off the API, like a dropped connection", async () => {
      svc.conversation.mockResolvedValue(header({ canSendPhotos: true }));
      svc.uploadPhoto.mockRejectedValue(new TypeError("Failed to fetch"));
      const { result } = await ready();
      act(() => result.current.attachPhoto(photoFile()));
      await waitFor(() =>
        expect(result.current.composerPhoto.draft?.error).toBe(CHAT_COPY.photoUploadFailed),
      );
    });

    it("resends a failed photo message without uploading the photo again", async () => {
      svc.conversation.mockResolvedValue(header({ canSendPhotos: true }));
      svc.uploadPhoto.mockResolvedValue("chat/c1/u1/p.jpg");
      svc.send.mockRejectedValueOnce(new Error("You're sending messages too fast. Wait a moment."));
      const { result } = await ready();
      act(() => result.current.attachPhoto(photoFile()));
      await waitFor(() => expect(result.current.composerPhoto.draft?.uploading).toBe(false));
      act(() => result.current.send(""));
      await waitFor(() => expect(result.current.thread.messages[2].status).toBe("failed"));

      svc.send.mockResolvedValueOnce({ ...msg("m9", "u1", 9), clientId: "x" });
      act(() => result.current.retry(result.current.thread.messages[2].clientId as string));
      await waitFor(() => expect(result.current.thread.messages[2].id).toBe("m9"));
      expect(svc.send).toHaveBeenLastCalledWith("c1", "", expect.any(String), "chat/c1/u1/p.jpg");
      expect(svc.uploadPhoto).toHaveBeenCalledTimes(1);
    });

    it("blurs the other member's photo until it's tapped, then opens it full size", async () => {
      svc.history.mockResolvedValue([{ ...msg("m1", "u2", 1), body: "", photo: theirPhoto }]);
      const { result } = await ready();
      expect(result.current.thread.messages[0].photo).toEqual({
        src: theirPhoto.previewUrl,
        fullSrc: null,
        hidden: true,
      });
      act(() => result.current.revealPhoto("m1"));
      expect(result.current.thread.messages[0].photo).toEqual({
        src: theirPhoto.thumbUrl,
        fullSrc: theirPhoto.url,
        hidden: false,
      });
      act(() => result.current.openPhoto(theirPhoto.url));
      expect(result.current.thread.viewingPhoto).toMatchObject({ fullSrc: theirPhoto.url });
      act(() => result.current.closePhoto());
      expect(result.current.thread.viewingPhoto).toBeNull();
    });
  });

  it("refetches the header after a block, so the composer gives way to the blocked notice", async () => {
    safety.block.mockResolvedValue({ blocked: "u2" });
    const { result } = await ready();
    expect(result.current.safety.blocked).toBeNull();
    svc.conversation.mockResolvedValue(
      header({
        peer: {
          userId: "u2",
          username: "ada",
          displayName: "Ada",
          avatarUrl: null,
          online: false,
          blockedByMe: true,
        },
      }),
    );
    act(() => result.current.safety.menu?.onSelect("block"));
    act(() => result.current.safety.blockDialog?.onConfirm());
    await waitFor(() => expect(result.current.safety.blocked).not.toBeNull());
    expect(safety.block).toHaveBeenCalledWith("u2");
    expect(result.current.thread.peer?.blockedByMe).toBe(true);
  });
});
