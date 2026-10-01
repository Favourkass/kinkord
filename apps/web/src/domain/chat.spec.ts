import { describe, expect, it } from "vitest";
import {
  isNewChatLimit,
  mergeMessages,
  newChatNotice,
  previewOf,
  toConversationRowVM,
  toPendingMessageVM,
  toThreadMessageVM,
  toThreadPeerVM,
  type ChatMessagePM,
  type ConversationSummaryPM,
} from "./chat";

const msg = (id: string, over: Partial<ChatMessagePM> = {}): ChatMessagePM => ({
  id,
  conversationId: "c1",
  senderId: "u2",
  body: "hello",
  photo: null,
  createdAt: "2026-09-28T10:00:00.000Z",
  editedAt: null,
  ...over,
});

const summary = (over: Partial<ConversationSummaryPM> = {}): ConversationSummaryPM => ({
  id: "c1",
  kind: "dm",
  lastMessageAt: "2026-09-28T10:00:00.000Z",
  peer: { userId: "u2", username: "ada", displayName: "Ada", avatarUrl: null, online: true },
  lastMessage: msg("m1"),
  unreadCount: 2,
  ...over,
});

const photo = {
  previewUrl: "https://media/p_sm.jpg",
  thumbUrl: "https://media/p_md.jpg",
  url: "https://media/p.jpg",
};

describe("chat photos", () => {
  it("previews a photo in the inbox, with its caption when it has one", () => {
    expect(previewOf(summary({ lastMessage: msg("m1", { body: "", photo }) }), "u1")).toBe(
      "📷 Photo",
    );
    expect(previewOf(summary({ lastMessage: msg("m1", { body: "look", photo }) }), "u1")).toBe(
      "📷 look",
    );
    const mine = msg("m1", { senderId: "u1", body: "", photo });
    expect(previewOf(summary({ lastMessage: mine }), "u1")).toBe("You: 📷 Photo");
  });

  it("blurs someone else's photo, loading only its smallest copy, until it's revealed", () => {
    const theirs = msg("m1", { photo });
    expect(toThreadMessageVM(theirs, "u1").photo).toEqual({
      src: photo.previewUrl,
      fullSrc: null,
      hidden: true,
    });
    expect(toThreadMessageVM(theirs, "u1", new Set(["m1"])).photo).toEqual({
      src: photo.thumbUrl,
      fullSrc: photo.url,
      hidden: false,
    });
  });

  it("never hides the viewer's own photos", () => {
    expect(toThreadMessageVM(msg("m1", { senderId: "u1", photo }), "u1").photo).toMatchObject({
      hidden: false,
      src: photo.thumbUrl,
    });
  });

  it("shows a photo still sending from the device", () => {
    const vm = toPendingMessageVM(
      {
        clientId: "tmp",
        body: "",
        photo: { localUrl: "blob:local", key: "chat/c1/u1/p.jpg" },
        createdAt: "2026-09-28T10:00:00Z",
        status: "sending",
      },
      "u1",
    );
    expect(vm.photo).toEqual({ src: "blob:local", fullSrc: null, hidden: false });
  });

  it("has no photo on a text message", () => {
    expect(toThreadMessageVM(msg("m1"), "u1").photo).toBeNull();
  });
});

describe("previewOf", () => {
  it("invites a first message on an empty thread", () => {
    expect(previewOf(summary({ lastMessage: null }), "u1")).toBe("Say hi 👋");
  });

  it("marks the viewer's own last message and clips long ones", () => {
    const long = "x".repeat(80);
    const own = summary({ lastMessage: msg("m1", { senderId: "u1", body: long }) });
    const text = previewOf(own, "u1");
    expect(text.startsWith("You: ")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBe("You: ".length + 60);
  });
});

describe("toConversationRowVM", () => {
  it("shows the other member, their presence and the unread count", () => {
    const vm = toConversationRowVM(summary(), "u1", (id) => `/messages/${id}`);
    expect(vm).toMatchObject({
      id: "c1",
      href: "/messages/c1",
      displayName: "Ada",
      preview: "hello",
      unread: 2,
      isOnline: true,
    });
  });
});

describe("thread view models", () => {
  it("decides whose bubble it is from the viewer", () => {
    expect(toThreadMessageVM(msg("m1", { senderId: "u1" }), "u1").isOwn).toBe(true);
    expect(toThreadMessageVM(msg("m1"), "u1").isOwn).toBe(false);
    // Before the viewer is known nothing is claimed as theirs.
    expect(toThreadMessageVM(msg("m1", { senderId: "u1" }), null).isOwn).toBe(false);
  });

  it("keeps a pending bubble's client id so it can be retried", () => {
    const vm = toPendingMessageVM(
      {
        clientId: "tmp",
        body: "hi",
        photo: null,
        createdAt: "2026-09-28T10:00:00Z",
        status: "failed",
      },
      "u1",
    );
    expect(vm).toMatchObject({ id: "tmp", clientId: "tmp", isOwn: true, status: "failed" });
  });

  it("has no peer once the other member is gone", () => {
    expect(toThreadPeerVM(null)).toBeNull();
    expect(toThreadPeerVM(summary().peer)).toMatchObject({ displayName: "Ada", isOnline: true });
  });
});

describe("mergeMessages", () => {
  it("keeps one copy of a message that arrived twice, oldest first", () => {
    const a = msg("a", { createdAt: "2026-09-28T10:00:00.000Z" });
    const b = msg("b", { createdAt: "2026-09-28T10:00:01.000Z" });
    const c = msg("c", { createdAt: "2026-09-28T10:00:02.000Z" });
    expect(mergeMessages([a, c], [c, b]).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("orders messages from the same moment by id so the order never flips", () => {
    const at = "2026-09-28T10:00:00.000Z";
    const out = mergeMessages([msg("b", { createdAt: at })], [msg("a", { createdAt: at })]);
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("newChatNotice", () => {
  const limited = (usedToday: number) =>
    ({ newChatsPerDay: 1, usedToday, resetsAt: "2026-09-30T23:00:00.000Z" }) as const;

  it("hints while today's new chat is still free, and blocks once it's used", () => {
    expect(newChatNotice({ empty: true, allowance: limited(0), refused: false })).toBe("hint");
    expect(newChatNotice({ empty: true, allowance: limited(1), refused: false })).toBe("blocked");
  });

  it("says nothing once a thread has messages: replies aren't limited", () => {
    expect(newChatNotice({ empty: false, allowance: limited(1), refused: true })).toBeNull();
  });

  it("says nothing to members without a limit, or before the allowance loads", () => {
    const unlimited = { newChatsPerDay: null } as const;
    expect(newChatNotice({ empty: true, allowance: unlimited, refused: false })).toBeNull();
    expect(newChatNotice({ empty: true, allowance: null, refused: false })).toBeNull();
  });

  it("blocks after the server refused a first message, whatever it said before", () => {
    expect(newChatNotice({ empty: true, allowance: limited(0), refused: true })).toBe("blocked");
  });
});

describe("isNewChatLimit", () => {
  it("recognises the API's refusal and nothing else", () => {
    expect(isNewChatLimit({ code: "NEW_CHAT_LIMIT", message: "x" })).toBe(true);
    expect(isNewChatLimit({ message: "You're sending messages too fast." })).toBe(false);
    expect(isNewChatLimit(null)).toBe(false);
    expect(isNewChatLimit("NEW_CHAT_LIMIT")).toBe(false);
  });
});
