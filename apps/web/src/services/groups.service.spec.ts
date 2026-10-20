import { beforeEach, describe, expect, it, vi } from "vitest";
import { groupsService } from "./groups.service";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
const put = vi.fn();
const patch = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    del: (...a: unknown[]) => del(...a),
    put: (...a: unknown[]) => put(...a),
    patch: (...a: unknown[]) => patch(...a),
  },
}));
const upload = vi.fn();
vi.mock("./posts.service", () => ({ uploadPostPhoto: (f: File) => upload(f) }));

beforeEach(() => {
  for (const f of [get, post, del, put, patch, upload]) f.mockReset();
});

describe("groupsService", () => {
  it("asks the directory for a view, a search, a category and a page", () => {
    groupsService.list({ view: "popular" });
    expect(get).toHaveBeenLastCalledWith("/groups?view=popular");
    groupsService.list({ view: "near", q: " munch ", category: "local", page: 2 });
    expect(get).toHaveBeenLastCalledWith("/groups?view=near&q=munch&category=local&page=2");
  });

  it("joins, leaves and moderates by the group's address", () => {
    groupsService.join("lagos-munch");
    expect(post).toHaveBeenLastCalledWith("/groups/lagos-munch/join", {});
    groupsService.leave("lagos-munch");
    expect(del).toHaveBeenLastCalledWith("/groups/lagos-munch/membership");
    groupsService.members("lagos-munch", "pending", 2);
    expect(get).toHaveBeenLastCalledWith("/groups/lagos-munch/members?status=pending&page=2");
    groupsService.setRole("lagos-munch", "u9", "moderator");
    expect(put).toHaveBeenLastCalledWith("/groups/lagos-munch/members/u9/role", {
      role: "moderator",
    });
    groupsService.pin("lagos-munch", "p1", true);
    expect(post).toHaveBeenLastCalledWith("/groups/lagos-munch/threads/p1/pin", { pinned: true });
  });

  it("uploads a discussion's photos first, then posts it naming them in order", async () => {
    upload.mockResolvedValueOnce("posts/me/a.jpg").mockResolvedValueOnce("posts/me/b.jpg");
    post.mockResolvedValueOnce({ id: "p1" });
    const a = new File(["a"], "a.jpg", { type: "image/jpeg" });
    const b = new File(["b"], "b.jpg", { type: "image/jpeg" });
    await groupsService.createThread("lagos-munch", {
      title: " First munch ",
      body: " Who's coming? ",
      photos: [a, b],
    });
    expect(upload.mock.calls.map(([f]) => f)).toEqual([a, b]);
    expect(post).toHaveBeenCalledWith("/groups/lagos-munch/threads", {
      title: "First munch",
      body: "Who's coming?",
      media: [
        { key: "posts/me/a.jpg", kind: "image" },
        { key: "posts/me/b.jpg", kind: "image" },
      ],
    });
  });
});
