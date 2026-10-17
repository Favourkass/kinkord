import { describe, it, expect } from "vitest";
import { toAdminPostsVM, type AdminPostPM } from "./adminPosts";
const post: AdminPostPM = {
  id: "p",
  body: "Private",
  authorId: "a",
  authorName: "A",
  username: "a",
  createdAt: "2026-10-17T00:00:00Z",
  visibility: "friends",
  archivedAt: null,
  deletedAt: null,
  repostOfId: null,
  media: [],
};
describe("admin post view models", () => {
  it("keeps original visibility and enables reversible archiving", () => {
    expect(
      toAdminPostsVM({
        items: [post, { ...post, archivedAt: post.createdAt }],
        page: 1,
        total: 21,
        limit: 20,
      }),
    ).toMatchObject({
      pages: 2,
      rows: [
        { visibility: "friends", status: "Active", canArchive: true, canDelete: true },
        { status: "Archived", canArchive: true },
      ],
    });
  });
  it("offers no mutation for deleted posts and keeps empty pagination valid", () => {
    expect(
      toAdminPostsVM({
        items: [{ ...post, deletedAt: post.createdAt, archivedAt: post.createdAt }],
        page: 1,
        total: 1,
        limit: 20,
      }).rows[0],
    ).toMatchObject({ status: "Deleted", canArchive: false, canDelete: false });
    expect(toAdminPostsVM({ items: [], total: 0, page: 1, limit: 20 }).pages).toBe(1);
  });
});
