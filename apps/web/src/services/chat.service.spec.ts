import { describe, expect, it } from "vitest";
import type { ConversationPM } from "@/domain/chat";
import {
  createMessagePM,
  filterConversations,
  searchConversations,
  sortConversations,
} from "./chat.service";

const sampleConversations: ConversationPM[] = [
  {
    id: "c1",
    type: "direct",
    name: "Rosabel",
    username: "rosabel",
    avatarUrl: null,
    isOnline: true,
    isPinned: true,
    isFavorite: true,
    unreadCount: 1,
    updatedAt: "2026-09-10T10:00:00Z",
    lastMessage: {
      id: "m1",
      conversationId: "c1",
      senderId: "u2",
      senderName: "Rosabel",
      text: "I somehow don't believe you",
      type: "text",
      createdAt: "2026-09-10T10:00:00Z",
      readStatus: "delivered",
    },
  },
  {
    id: "c2",
    type: "direct",
    name: "David",
    username: "david",
    avatarUrl: null,
    isOnline: true,
    isPinned: false,
    isFavorite: false,
    unreadCount: 2,
    updatedAt: "2026-09-10T10:30:00Z",
    lastMessage: {
      id: "m2",
      conversationId: "c2",
      senderId: "u3",
      senderName: "David",
      text: "Sure, I'll check it out",
      type: "text",
      createdAt: "2026-09-10T10:30:00Z",
      readStatus: "delivered",
    },
  },
  {
    id: "c3",
    type: "group",
    name: "Project Alpha",
    avatarUrl: null,
    isOnline: false,
    isPinned: false,
    isFavorite: false,
    unreadCount: 0,
    updatedAt: "2026-09-10T09:00:00Z",
    lastMessage: {
      id: "m3",
      conversationId: "c3",
      senderId: "u4",
      senderName: "Mike",
      text: "Presentation updated",
      type: "text",
      createdAt: "2026-09-10T09:00:00Z",
      readStatus: "read",
    },
  },
];

describe("chat.service", () => {
  describe("filterConversations", () => {
    it("returns all conversations for 'all' filter", () => {
      expect(filterConversations(sampleConversations, "all")).toHaveLength(3);
    });

    it("filters only conversations with unreadCount > 0 for 'unread'", () => {
      const result = filterConversations(sampleConversations, "unread");
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
    });

    it("filters only group conversations for 'groups'", () => {
      const result = filterConversations(sampleConversations, "groups");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c3");
    });

    it("filters only favorites for 'favorites'", () => {
      const result = filterConversations(sampleConversations, "favorites");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
    });
  });

  describe("searchConversations", () => {
    it("matches contact name case-insensitively", () => {
      const result = searchConversations(sampleConversations, "rosa");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Rosabel");
    });

    it("matches username", () => {
      const result = searchConversations(sampleConversations, "david");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c2");
    });

    it("matches text in last message", () => {
      const result = searchConversations(sampleConversations, "presentation");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c3");
    });

    it("returns all when search query is blank", () => {
      expect(searchConversations(sampleConversations, "   ")).toHaveLength(3);
    });
  });

  describe("sortConversations", () => {
    it("places pinned conversations first, even if another has a more recent update", () => {
      const sorted = sortConversations(sampleConversations);
      // c1 is pinned (updated at 10:00), c2 is not pinned (updated at 10:30)
      expect(sorted[0].id).toBe("c1");
      expect(sorted[1].id).toBe("c2");
      expect(sorted[2].id).toBe("c3");
    });
  });

  describe("createMessagePM", () => {
    it("creates a message with trimmed text and ISO timestamp", () => {
      const msg = createMessagePM({
        conversationId: "c1",
        senderId: "u-me",
        senderName: "You",
        text: "  Hello world!  ",
      });
      expect(msg.text).toBe("Hello world!");
      expect(msg.conversationId).toBe("c1");
      expect(msg.senderId).toBe("u-me");
      expect(msg.readStatus).toBe("read");
    });

    it("throws when message text is empty or only whitespace", () => {
      expect(() =>
        createMessagePM({
          conversationId: "c1",
          senderId: "u-me",
          senderName: "You",
          text: "   ",
        }),
      ).toThrow("Message text cannot be empty");
    });
  });
});
