// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useGroupThreadPresenter } from "./useGroupThreadPresenter";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const groups = { thread: vi.fn(), pin: vi.fn(), close: vi.fn(), removeThread: vi.fn() };
vi.mock("@/services/groups.service", () => ({
  groupsService: new Proxy(
    {},
    {
      get:
        (_t, prop: string) =>
        (...a: unknown[]) =>
          (groups as Record<string, (...x: unknown[]) => unknown>)[prop](...a),
    },
  ),
}));
const posts = {
  comments: vi.fn(),
  comment: vi.fn(),
  like: vi.fn(),
  unlike: vi.fn(),
  removeComment: vi.fn(),
};
vi.mock("@/services/posts.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/posts.service")>()),
  postsApi: new Proxy(
    {},
    {
      get:
        (_t, prop: string) =>
        (...a: unknown[]) =>
          (posts as Record<string, (...x: unknown[]) => unknown>)[prop](...a),
    },
  ),
}));

const access = (over = {}) => ({
  member: false,
  pending: false,
  canRead: true,
  canPost: false,
  canModerate: false,
  isOwner: false,
  ...over,
});
const thread = (over = {}) => ({
  id: "p1",
  postId: "p1",
  title: "First munch",
  body: "Saturday at 4.",
  visibility: "public",
  author: { userId: "u2", username: "ada", displayName: "Ada", avatarUrl: null, silver: false },
  media: [],
  likes: 1,
  comments: 1,
  reposts: 0,
  likedByMe: false,
  repostedByMe: false,
  savedByMe: false,
  repostedBy: null,
  mine: false,
  createdAt: "2026-10-01T00:00:00Z",
  pinned: false,
  closed: false,
  group: { id: "g1", slug: "lagos-munch", name: "Lagos Munch" },
  ...over,
});
const loaded = (a = access(), t = thread()) =>
  groups.thread.mockResolvedValue({
    group: { name: "Lagos Munch", team: [{ userId: "mod1" }], access: a },
    thread: t,
  });
const reply = (id: string, userId: string) => ({
  id,
  body: `reply ${id}`,
  createdAt: "2026-10-02T00:00:00Z",
  author: { userId, username: userId, displayName: userId, avatarUrl: null },
  canDelete: false,
});

beforeEach(() => {
  for (const f of [...Object.values(groups), ...Object.values(posts)]) f.mockReset();
  router.push.mockReset();
  posts.comments.mockResolvedValue({
    items: [reply("c1", "u2"), reply("c2", "mod1")],
    nextCursor: null,
    total: 2,
  });
});
afterEach(cleanup);

describe("useGroupThreadPresenter", () => {
  it("reads replies oldest first, labelling the author and the moderators", async () => {
    loaded();
    const { result } = renderHook(() => useGroupThreadPresenter("lagos-munch", "p1"));
    await waitFor(() => expect(result.current.replies.rows).toHaveLength(2));
    expect(posts.comments).toHaveBeenCalledWith("p1", null, 20, "oldest");
    expect(result.current.replies.rows.map((r) => r.label)).toEqual(["Author", "Mod"]);
    expect(result.current.back).toEqual({ label: "Back to Lagos Munch", href: "/g/lagos-munch" });
  });

  it("lets a reader who hasn't joined read, but not like or reply", async () => {
    loaded();
    const { result } = renderHook(() => useGroupThreadPresenter("lagos-munch", "p1"));
    await waitFor(() => expect(result.current.thread).not.toBeNull());
    expect(result.current.thread?.onLike).toBeNull();
    expect(result.current.composer).toBeNull();
    expect(result.current.composerNote).toBe("Join the group to reply.");
    expect(result.current.actions).toEqual([]);
  });

  it("adds a member's reply at the end", async () => {
    loaded(access({ member: true, canPost: true }));
    posts.comment.mockResolvedValue(reply("c3", "me"));
    const { result } = renderHook(() => useGroupThreadPresenter("lagos-munch", "p1"));
    await waitFor(() => expect(result.current.composer).not.toBeNull());
    await waitFor(() => expect(result.current.replies.rows).toHaveLength(2));
    act(() => result.current.composer?.onChange("Count me in"));
    await act(async () => result.current.composer?.submit.onClick());
    expect(posts.comment).toHaveBeenCalledWith("p1", "Count me in");
    expect(result.current.replies.rows.at(-1)?.id).toBe("c3");
    expect(result.current.thread?.replies).toBe("2 replies");
  });

  it("takes no replies on a closed discussion", async () => {
    loaded(access({ member: true, canPost: true }), thread({ closed: true }));
    const { result } = renderHook(() => useGroupThreadPresenter("lagos-munch", "p1"));
    await waitFor(() => expect(result.current.thread).not.toBeNull());
    expect(result.current.composer).toBeNull();
    expect(result.current.composerNote).toBe("This discussion is closed to new replies.");
  });

  it("gives moderators pin, close and remove", async () => {
    loaded(access({ member: true, canPost: true, canModerate: true }));
    groups.pin.mockResolvedValue({ pinned: true });
    const { result } = renderHook(() => useGroupThreadPresenter("lagos-munch", "p1"));
    await waitFor(() =>
      expect(result.current.actions.map((a) => a.key)).toEqual(["pin", "close", "remove"]),
    );
    await act(async () => result.current.actions[0].onClick());
    expect(groups.pin).toHaveBeenCalledWith("lagos-munch", "p1", true);
    expect(result.current.thread?.pinned).toBe("Pinned");
    act(() => result.current.actions.find((a) => a.key === "remove")?.onClick());
    expect(result.current.confirm.open).toBe(true);
    groups.removeThread.mockResolvedValue({ deleted: "p1" });
    await act(async () => result.current.confirm.onConfirm());
    expect(router.push).toHaveBeenCalledWith("/g/lagos-munch");
  });
});
