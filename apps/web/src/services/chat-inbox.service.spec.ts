import { describe, expect, it } from "vitest";
import type { ConversationSummaryPM } from "@/domain/chat";
import { selectChatInbox } from "./chat-inbox.service";

const summaries: ConversationSummaryPM[] = [
  {
    id: "a",
    kind: "dm",
    lastMessageAt: "2026-10-09T10:00:00Z",
    peer: {
      userId: "a",
      username: "ada",
      displayName: "Ada",
      avatarUrl: null,
      online: true,
      blockedByMe: false,
    },
    lastMessage: null,
    unreadCount: 4,
  },
  {
    id: "b",
    kind: "dm",
    lastMessageAt: "2026-10-09T10:00:00Z",
    peer: {
      userId: "b",
      username: "bola",
      displayName: "Bola",
      avatarUrl: null,
      online: false,
      blockedByMe: false,
    },
    lastMessage: null,
    unreadCount: 0,
  },
  {
    id: "g",
    kind: "group",
    lastMessageAt: "2026-10-09T10:00:00Z",
    peer: null,
    lastMessage: null,
    unreadCount: 2,
  },
];
describe("selectChatInbox", () => {
  it("counts conversations rather than messages and filters each category", () => {
    expect(selectChatInbox(summaries, "", "all").counts).toEqual({
      all: 3,
      unread: 2,
      online: 1,
      groups: 1,
    });
    expect(selectChatInbox(summaries, "", "unread").items.map((s) => s.id)).toEqual(["a", "g"]);
    expect(selectChatInbox(summaries, "", "online").items.map((s) => s.id)).toEqual(["a"]);
    expect(selectChatInbox(summaries, "", "groups").items.map((s) => s.id)).toEqual(["g"]);
  });
  it("searches names and usernames without changing saved data or order", () => {
    const before = structuredClone(summaries);
    expect(selectChatInbox(summaries, "  BoLA  ", "all").items.map((s) => s.id)).toEqual(["b"]);
    expect(selectChatInbox(summaries, "missing", "all").counts.all).toBe(0);
    expect(selectChatInbox(summaries, "", "all").items.map((s) => s.id)).toEqual(["a", "b", "g"]);
    expect(summaries).toEqual(before);
  });
});
