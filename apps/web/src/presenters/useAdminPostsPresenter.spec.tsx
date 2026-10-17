// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { useAdminPostsPresenter } from "./useAdminPostsPresenter";
const { service, access } = vi.hoisted(() => ({
  service: { list: vi.fn(), archive: vi.fn(), remove: vi.fn() },
  access: { isAdmin: true, checking: false },
}));
vi.mock("@/services/adminPosts.service", () => ({ adminPostsService: service }));
vi.mock("./useAdminAccessPresenter", () => ({ useAdminAccessPresenter: () => access }));
const row = {
  id: "p",
  body: "Post",
  authorName: "A",
  username: "a",
  authorId: "a",
  createdAt: "2026-10-17T00:00:00Z",
  visibility: "public" as const,
  archivedAt: null,
  deletedAt: null,
  repostOfId: null,
  media: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  access.isAdmin = true;
  service.list.mockResolvedValue({ items: [row], total: 21, page: 1, limit: 20 });
  service.archive.mockResolvedValue({});
  service.remove.mockResolvedValue({});
});
afterEach(cleanup);
it("never loads all posts for a non-admin", () => {
  access.isAdmin = false;
  renderHook(useAdminPostsPresenter);
  expect(service.list).not.toHaveBeenCalled();
});
it("starts with every post, pages and resets paging when status changes", async () => {
  const h = renderHook(useAdminPostsPresenter);
  await waitFor(() => expect(h.result.current.vm).not.toBeNull());
  expect(service.list).toHaveBeenCalledWith(1, "all");
  act(() => h.result.current.next());
  await waitFor(() => expect(service.list).toHaveBeenCalledWith(2, "all"));
  act(() => h.result.current.setStatus("archived"));
  await waitFor(() => expect(service.list).toHaveBeenCalledWith(1, "archived"));
});
it("requires confirmation before archive/delete and reloads after success", async () => {
  const h = renderHook(useAdminPostsPresenter);
  await waitFor(() => expect(h.result.current.vm).not.toBeNull());
  act(() => h.result.current.onArchive(row));
  expect(service.archive).not.toHaveBeenCalled();
  await act(async () => h.result.current.dialog?.confirm());
  expect(service.archive).toHaveBeenCalledWith("p", true);
  await waitFor(() => expect(h.result.current.dialog).toBeNull());
  act(() => h.result.current.onDelete(row));
  expect(service.remove).not.toHaveBeenCalled();
  expect(h.result.current.dialog?.body).toContain("cannot be undone");
  await act(async () => h.result.current.dialog?.confirm());
  expect(service.remove).toHaveBeenCalledWith("p");
});
it("keeps failures visible and does not claim success", async () => {
  service.archive.mockRejectedValue(new Error("Permission refused"));
  const h = renderHook(useAdminPostsPresenter);
  await waitFor(() => expect(h.result.current.vm).not.toBeNull());
  act(() => h.result.current.onArchive(row));
  await act(async () => h.result.current.dialog?.confirm());
  expect(h.result.current.dialog?.error).toBe("Permission refused");
});
