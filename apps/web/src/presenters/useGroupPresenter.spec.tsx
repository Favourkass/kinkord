// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useGroupPresenter } from "./useGroupPresenter";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const svc = {
  detail: vi.fn(),
  threads: vi.fn(),
  members: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  approve: vi.fn(),
  removeMember: vi.fn(),
  setRole: vi.fn(),
  createThread: vi.fn(),
  closeDown: vi.fn(),
};
vi.mock("@/services/groups.service", () => ({
  groupsService: new Proxy(
    {},
    {
      get:
        (_t, prop: string) =>
        (...a: unknown[]) =>
          (svc as Record<string, (...x: unknown[]) => unknown>)[prop](...a),
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
const group = (over = {}) => ({
  id: "g1",
  slug: "lagos-munch",
  name: "Lagos Munch",
  description: "A monthly munch.",
  rules: "Be kind.",
  category: "local",
  privacy: "open",
  country: "NG",
  state: "Lagos",
  members: 12,
  role: null,
  status: null,
  createdAt: "2026-10-01T00:00:00Z",
  team: [],
  access: access(),
  requests: null,
  ...over,
});
const thread = {
  id: "p1",
  postId: "p1",
  title: "First munch",
  body: "Saturday at 4.",
  author: { userId: "u2", displayName: "Ada", avatarUrl: null },
  comments: 2,
  createdAt: "2026-10-01T00:00:00Z",
  lastActivityAt: "2026-10-02T00:00:00Z",
  pinned: false,
  closed: false,
};

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
  router.push.mockReset();
  svc.threads.mockResolvedValue({ items: [thread], nextCursor: null });
  svc.members.mockResolvedValue({ items: [], hasMore: false });
  svc.join.mockResolvedValue({ status: "active" });
  svc.leave.mockResolvedValue({ status: null });
});
afterEach(cleanup);

describe("useGroupPresenter", () => {
  it("keeps a closed group's discussions and members from a non-member, offering to ask", async () => {
    svc.detail.mockResolvedValue(group({ privacy: "closed", access: access({ canRead: false }) }));
    const { result } = renderHook(() => useGroupPresenter("lagos-munch"));
    await waitFor(() => expect(result.current.header?.closed).toBe(true));
    expect(result.current.primary?.label).toBe("Ask to join");
    expect(result.current.note).toMatch(/This group is closed/);
    expect(result.current.tabs.map((t) => t.key)).toEqual(["discussions", "about"]);
    expect(svc.threads).not.toHaveBeenCalled();
  });

  it("reads an open group's discussions to anyone, and joins it in one tap", async () => {
    svc.detail.mockResolvedValue(group());
    const { result } = renderHook(() => useGroupPresenter("lagos-munch"));
    await waitFor(() => expect(result.current.discussions.rows).toHaveLength(1));
    expect(result.current.discussions.rows[0]).toMatchObject({
      title: "First munch",
      href: "/g/lagos-munch/t/p1",
      replies: "2 replies",
    });
    expect(result.current.discussions.canPost).toBe(false);
    expect(result.current.discussions.joinNote).toMatch(/Join the group/);
    svc.detail.mockResolvedValue(
      group({ access: access({ member: true, canPost: true }), role: "member", status: "active" }),
    );
    await act(async () => result.current.primary?.onClick());
    expect(svc.join).toHaveBeenCalledWith("lagos-munch");
    await waitFor(() => expect(result.current.primary?.label).toBe("Leave group"));
  });

  it("asks before leaving", async () => {
    svc.detail.mockResolvedValue(
      group({ access: access({ member: true, canPost: true }), role: "member", status: "active" }),
    );
    const { result } = renderHook(() => useGroupPresenter("lagos-munch"));
    await waitFor(() => expect(result.current.primary?.label).toBe("Leave group"));
    act(() => result.current.primary?.onClick());
    expect(svc.leave).not.toHaveBeenCalled();
    expect(result.current.confirm.open).toBe(true);
    await act(async () => result.current.confirm.onConfirm());
    expect(svc.leave).toHaveBeenCalledWith("lagos-munch");
  });

  it("shows a closed group's moderators its requests, and approving lets the member in", async () => {
    svc.detail.mockResolvedValue(
      group({
        privacy: "closed",
        requests: 1,
        access: access({ member: true, canPost: true, canModerate: true }),
        role: "moderator",
        status: "active",
      }),
    );
    svc.members.mockImplementation((_slug: string, status: string) =>
      Promise.resolve({
        items:
          status === "pending"
            ? [
                {
                  userId: "u9",
                  username: "bob",
                  displayName: "Bob",
                  avatarUrl: null,
                  role: "member",
                  status: "pending",
                  since: "2026-10-19T00:00:00Z",
                  silver: false,
                  teamMember: false,
                },
              ]
            : [],
        hasMore: false,
      }),
    );
    svc.approve.mockResolvedValue({ status: "active" });
    const { result } = renderHook(() => useGroupPresenter("lagos-munch", "requests"));
    await waitFor(() => expect(result.current.requests.rows).toHaveLength(1));
    expect(result.current.tabs.find((t) => t.key === "requests")?.label).toBe("Requests (1)");
    // Once approved, the API no longer lists Bob as waiting.
    svc.members.mockResolvedValue({ items: [], hasMore: false });
    await act(async () => result.current.requests.rows[0].approve.onClick());
    expect(svc.approve).toHaveBeenCalledWith("lagos-munch", "u9");
    expect(result.current.requests.rows).toHaveLength(0);
  });

  it("posts a new discussion only with a title and a message, then opens it", async () => {
    svc.detail.mockResolvedValue(
      group({ access: access({ member: true, canPost: true }), role: "member", status: "active" }),
    );
    svc.createThread.mockResolvedValue({ id: "p9", postId: "p9" });
    const { result } = renderHook(() => useGroupPresenter("lagos-munch"));
    await waitFor(() => expect(result.current.discussions.canPost).toBe(true));
    act(() => result.current.discussions.composer.onOpen());
    act(() => result.current.discussions.composer.title.onChange("Hi"));
    expect(result.current.discussions.composer.submit.disabled).toBe(true);
    act(() => {
      result.current.discussions.composer.title.onChange("Second munch");
      result.current.discussions.composer.body.onChange("Same place?");
    });
    expect(result.current.discussions.composer.submit.disabled).toBe(false);
    await act(async () => result.current.discussions.composer.submit.onClick());
    expect(svc.createThread).toHaveBeenCalledWith("lagos-munch", {
      title: "Second munch",
      body: "Same place?",
      photos: [],
    });
    expect(router.push).toHaveBeenCalledWith("/g/lagos-munch/t/p9");
  });

  it("says when a group is gone", async () => {
    const { ApiError } = await import("@/services/apiClient");
    svc.detail.mockRejectedValue(new ApiError(404, {}));
    const { result } = renderHook(() => useGroupPresenter("nope"));
    await waitFor(() => expect(result.current.loadError).toMatch(/doesn't exist/));
  });
});
