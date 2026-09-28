import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
  },
}));

import { chatService } from "./chat.service";

describe("chatService", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue([]);
    post.mockReset().mockResolvedValue({});
  });

  it("asks for the newest page, or for what came after a message", async () => {
    await chatService.history("c1");
    await chatService.history("c1", { after: "m9" });
    await chatService.history("c1", { before: "m1" });
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      "/chat/conversations/c1/messages",
      "/chat/conversations/c1/messages?after=m9",
      "/chat/conversations/c1/messages?before=m1",
    ]);
  });

  it("sends the text with the client id that ties the reply to the bubble", async () => {
    await chatService.send("c1", "hi", "tmp-1");
    expect(post).toHaveBeenCalledWith("/chat/conversations/c1/messages", {
      body: "hi",
      clientId: "tmp-1",
    });
  });

  it("opens a thread with a member, and marks a message read", async () => {
    await chatService.start("u2");
    await chatService.markRead("c1", "m3");
    expect(post.mock.calls).toEqual([
      ["/chat/conversations", { userId: "u2" }],
      ["/chat/conversations/c1/read", { messageId: "m3" }],
    ]);
  });
});
