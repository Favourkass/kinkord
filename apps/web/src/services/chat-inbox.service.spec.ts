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
];
describe("selectChatInbox", () => {
  it("counts conversations rather than messages and filters each category", () => {
    expect(selectChatInbox(summaries, "", "all").counts).toEqual({ all: 2, unread: 1, online: 1 });
    expect(selectChatInbox(summaries, "", "unread").items.map((s) => s.id)).toEqual(["a"]);
    expect(selectChatInbox(summaries, "", "online").items.map((s) => s.id)).toEqual(["a"]);
  });
  it("adds older chats the API's search found, newest first, keeping the loaded copies", () => {
    const older: ConversationSummaryPM = {
      ...summaries[1],
      id: "c",
      lastMessageAt: "2026-09-01T10:00:00Z",
      peer: { ...summaries[1].peer!, userId: "c", username: "adaeze", displayName: "Adaeze" },
    };
    const stale = { ...summaries[0], unreadCount: 0 };
    const result = selectChatInbox(summaries, "ada", "all", [stale, older]);
    expect(result.items.map((s) => s.id)).toEqual(["a", "c"]);
    // The loaded Ada is fresher than the API's copy: 4 unread, not 0.
    expect(result.items[0].unreadCount).toBe(4);
    expect(result.counts.all).toBe(2);
    // The API's counts, of every chat, win over the loaded page's once they're in.
    expect(
      selectChatInbox(summaries, "", "all", null, { all: 73, unread: 4, online: 9 }).counts,
    ).toEqual({ all: 73, unread: 4, online: 9 });
    // A tab keeps only chats that belong to it, even ones the API sent.
    expect(
      selectChatInbox(summaries, "", "unread", [older, { ...stale, unreadCount: 3 }]).items.map(
        (s) => s.id,
      ),
    ).toEqual(["a"]);
    // When the API's answer is newer, it's the latest word: Bola came online since the inbox loaded.
    const online = { ...summaries[1], peer: { ...summaries[1].peer!, online: true } };
    expect(
      selectChatInbox(summaries, "", "online", [summaries[0], online], null, true).items.map(
        (s) => s.id,
      ),
    ).toEqual(["a", "b"]);
    expect(
      selectChatInbox(summaries, "", "online", [summaries[0], online], null, false).items.map(
        (s) => s.id,
      ),
    ).toEqual(["a"]);
    // And what it left out is gone: Bola blocked the viewer, so searching Bola finds nothing.
    expect(selectChatInbox(summaries, "bola", "all", [], null, true).items).toEqual([]);
    // An answer for another search, or none yet, changes nothing.
    expect(selectChatInbox(summaries, "ada", "all").items.map((s) => s.id)).toEqual(["a"]);
  });
  it("searches names and usernames without changing saved data or order", () => {
    const before = structuredClone(summaries);
    expect(selectChatInbox(summaries, "  BoLA  ", "all").items.map((s) => s.id)).toEqual(["b"]);
    expect(selectChatInbox(summaries, "missing", "all").counts.all).toBe(0);
    expect(selectChatInbox(summaries, "", "all").items.map((s) => s.id)).toEqual(["a", "b"]);
    expect(summaries).toEqual(before);
  });
});
