// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "./apiClient";
import { chatService } from "./chat.service";
import { postsApi } from "./posts.service";
import { externalShareUrl, sharingService } from "./sharing.service";
vi.mock("./apiClient", () => ({ api: { get: vi.fn(), post: vi.fn(), del: vi.fn() } }));
vi.mock("./chat.service", () => ({ chatService: { start: vi.fn(), send: vi.fn() } }));
vi.mock("./posts.service", () => ({
  postsApi: { share: vi.fn() },
  postPermalink: (id: string) => `https://kinkord.com/p/${id}`,
}));
beforeEach(() => vi.resetAllMocks());
it("encodes external URLs and captions", () => {
  const url = new URL(externalShareUrl("twitter", "https://kinkord.com/p/a", "A & B"));
  expect(url.searchParams.get("text")).toBe("A & B");
  expect(url.searchParams.get("url")).toBe("https://kinkord.com/p/a");
  expect(
    decodeURIComponent(externalShareUrl("whatsapp", "https://kinkord.com/p/a", "Hello")),
  ).toContain("Hello\n\nhttps://kinkord.com/p/a");
});
it("sends through existing chat APIs before recording a share", async () => {
  vi.mocked(chatService.start).mockResolvedValue({ conversationId: "thread" });
  vi.mocked(chatService.send).mockResolvedValue({} as never);
  vi.mocked(postsApi.share).mockResolvedValue({ postId: "p", shares: 1 });
  await sharingService.friend("friend", "p", "Hi", "client-id");
  expect(chatService.send).toHaveBeenCalledWith(
    "thread",
    "Hi\n\nhttps://kinkord.com/p/p",
    "client-id",
  );
  expect(postsApi.share).toHaveBeenCalledWith("p");
});
it("does not count rejected messages", async () => {
  vi.mocked(chatService.start).mockRejectedValue(new Error("Premium required"));
  await expect(sharingService.friend("f", "p", "", "id")).rejects.toThrow("Premium");
  expect(postsApi.share).not.toHaveBeenCalled();
});
it("does not turn a delivered message into failure when counting fails", async () => {
  vi.mocked(chatService.start).mockResolvedValue({ conversationId: "t" });
  vi.mocked(chatService.send).mockResolvedValue({} as never);
  vi.mocked(postsApi.share).mockRejectedValue(new Error("Offline"));
  await expect(sharingService.friend("f", "p", "", "id")).resolves.toBeNull();
});
it("does not claim an external-window share was completed", async () => {
  vi.spyOn(window, "open").mockReturnValue({ opener: window } as Window);
  await expect(sharingService.external("whatsapp", "p", "")).resolves.toBeNull();
  expect(postsApi.share).not.toHaveBeenCalled();
});
it("looks up friends to send to, and shares to the feed with the caption", async () => {
  await sharingService.friends(" a&b ");
  expect(api.get).toHaveBeenCalledWith("/posts/share-friends?q=a%26b");
  await sharingService.feed("p/1", "Caption");
  expect(api.post).toHaveBeenCalledWith("/posts/p%2F1/share-feed", { caption: "Caption" });
});
