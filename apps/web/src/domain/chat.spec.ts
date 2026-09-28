import { describe, expect, it } from "vitest";
import {
  mergeMessages,
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
      { clientId: "tmp", body: "hi", createdAt: "2026-09-28T10:00:00Z", status: "failed" },
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
