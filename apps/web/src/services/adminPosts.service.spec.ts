import { it, expect, vi } from "vitest";
const { get, post, del } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));
vi.mock("./apiClient", () => ({ api: { get, post, del } }));
import { adminPostsService } from "./adminPosts.service";
it("reads a bounded page and keeps archive/restore separate from deletion", async () => {
  await adminPostsService.list(2, "archived");
  expect(get).toHaveBeenCalledWith("/admin/posts?page=2&status=archived");
  await adminPostsService.archive("p/1", true);
  await adminPostsService.archive("p/1", false);
  await adminPostsService.remove("p/1");
  expect(post.mock.calls).toEqual([
    ["/admin/posts/p%2F1/archive", { archived: true }],
    ["/admin/posts/p%2F1/archive", { archived: false }],
  ]);
  expect(del).toHaveBeenCalledWith("/admin/posts/p%2F1");
});
