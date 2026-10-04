import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const upload = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
  },
  uploadToPresignedUrl: (...a: unknown[]) => upload(...a),
}));

// The browser's resize needs a canvas; the sizes it makes are stood in for here.
const sized = (name: string) => new File(["x".repeat(10)], name, { type: "image/jpeg" });
const set = { original: sized("o.jpg"), variants: { sm: sized("s.jpg"), md: sized("m.jpg") } };
const buildUploadSet = vi.fn<(file: File, kind: string) => Promise<typeof set>>(async () => set);
vi.mock("@/util/image", () => ({
  IMAGE_VARIANTS: ["sm", "md"],
  buildUploadSet: (file: File, kind: string) => buildUploadSet(file, kind),
}));

import { chatService } from "./chat.service";

describe("chatService", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue([]);
    post.mockReset().mockResolvedValue({});
    upload.mockReset().mockResolvedValue(undefined);
  });

  it("uploads a photo in every size into the thread's slot, the original last", async () => {
    post.mockResolvedValueOnce({
      key: "chat/c1/u1/p.jpg",
      uploadUrl: "https://up/p.jpg",
      variantUploadUrls: { sm: "https://up/p_sm.jpg", md: "https://up/p_md.jpg" },
    });
    const raw = new File(["raw"], "IMG_0001.jpg", { type: "image/jpeg" });
    await expect(chatService.uploadPhoto("c1", raw)).resolves.toBe("chat/c1/u1/p.jpg");
    expect(buildUploadSet).toHaveBeenCalledWith(raw, "chat");
    expect(post).toHaveBeenCalledWith("/chat/conversations/c1/photo-upload-url", {
      contentType: "image/jpeg",
      contentLength: set.original.size,
    });
    // The original goes last, so a key only ever names an upload whose sizes exist.
    expect(upload.mock.calls).toEqual([
      ["https://up/p_sm.jpg", set.variants.sm],
      ["https://up/p_md.jpg", set.variants.md],
      ["https://up/p.jpg", set.original],
    ]);
  });

  it("sends a photo by its key, with the text as its caption", async () => {
    await chatService.send("c1", "look", "tmp-2", "chat/c1/u1/p.jpg");
    expect(post).toHaveBeenCalledWith("/chat/conversations/c1/messages", {
      body: "look",
      clientId: "tmp-2",
      photoKey: "chat/c1/u1/p.jpg",
    });
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

  it("asks for today's new-chat allowance", async () => {
    await chatService.allowance();
    expect(get).toHaveBeenCalledWith("/chat/allowance");
  });
});

it("requests a total unread count independently of the capped chat list", async () => {
  get.mockResolvedValueOnce({ count: 8 });
  await expect(chatService.unreadCount()).resolves.toEqual({ count: 8 });
  expect(get).toHaveBeenLastCalledWith("/chat/unread-count");
});
