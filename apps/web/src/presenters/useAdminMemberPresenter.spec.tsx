// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AdminMemberDetailPM } from "@/domain/moderation";
import { useAdminMemberPresenter } from "./useAdminMemberPresenter";

// One object for the whole file: a fresh router each render would re-run effects.
const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const svc = {
  access: vi.fn(),
  member: vi.fn(),
  block: vi.fn(),
  unblock: vi.fn(),
  deleteMember: vi.fn(),
  deleteMemberPosts: vi.fn(),
  deletePost: vi.fn(),
};
vi.mock("@/services/moderation.service", () => ({
  moderationService: new Proxy(
    {},
    {
      get:
        (_t, name: string) =>
        (...a: unknown[]) =>
          svc[name as keyof typeof svc](...a),
    },
  ),
}));

const detail: AdminMemberDetailPM = {
  id: "u9",
  name: "Durowara Tolulope Charles",
  displayName: null,
  username: "downtoearth",
  email: "ctolulope05@gmail.com",
  phone: "+2349054291043",
  avatarUrl: null,
  createdAt: "2026-09-04T16:24:27.065Z",
  lastSeenAt: null,
  posts: 1,
  banned: false,
  admin: false,
  ips: [],
  verifiedPhones: [],
  banReason: null,
  bannedAt: null,
  recentPosts: [
    {
      id: "p1",
      body: "hello",
      createdAt: "2026-09-20T10:00:00Z",
      visibility: "public",
      isRepost: false,
      mediaCount: 0,
      thumbUrl: null,
    },
  ],
  rules: [],
};

async function ready() {
  const hook = renderHook(() => useAdminMemberPresenter("u9"));
  await waitFor(() => expect(hook.result.current.vm).not.toBeNull());
  return hook;
}

describe("useAdminMemberPresenter", () => {
  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    router.replace.mockReset();
    svc.access.mockResolvedValue({ isAdmin: true });
    svc.member.mockResolvedValue(detail);
    svc.block.mockResolvedValue({ blocked: "u9", postsRemoved: 1 });
    svc.deleteMember.mockResolvedValue({ deleted: "u9" });
    svc.deletePost.mockResolvedValue({ deleted: "p1" });
  });
  afterEach(cleanup);

  it("loads the member for an admin", async () => {
    const { result } = await ready();
    expect(result.current.vm?.title).toBe("Durowara Tolulope Charles");
    expect(result.current.dialog).toBeNull();
  });

  it("blocks with the reason and the delete-posts choice, then reloads", async () => {
    const { result } = await ready();
    act(() => result.current.onBlock());
    act(() => result.current.dialog?.reason?.set("harassment"));
    act(() => result.current.dialog?.checkbox?.toggle());
    await act(async () => result.current.dialog?.confirm());

    expect(svc.block).toHaveBeenCalledWith("u9", { reason: "harassment", deletePosts: true });
    await waitFor(() => expect(svc.member).toHaveBeenCalledTimes(2));
    expect(result.current.dialog).toBeNull();
    expect(result.current.notice).toBe("Blocked, and 1 posts deleted.");
  });

  it("won't delete the account until the username is typed", async () => {
    const { result } = await ready();
    act(() => result.current.onDeleteAccount());
    // Deleting blocks re-sign-up by default.
    expect(result.current.dialog?.checkbox?.checked).toBe(true);
    expect(result.current.dialog?.canConfirm).toBe(false);
    act(() => result.current.dialog?.typeToConfirm?.set("@DownToEarth"));
    expect(result.current.dialog?.canConfirm).toBe(true);

    await act(async () => result.current.dialog?.confirm());
    expect(svc.deleteMember).toHaveBeenCalledWith("u9", { block: true, reason: null });
    expect(router.replace).toHaveBeenCalledWith("/moderation");
  });

  it("deletes a single post by its id", async () => {
    const { result } = await ready();
    act(() => result.current.onDeletePost("p1"));
    expect(result.current.dialog?.title).toBe("Delete this post?");
    await act(async () => result.current.dialog?.confirm());
    expect(svc.deletePost).toHaveBeenCalledWith("p1");
    expect(result.current.notice).toBe("Post deleted.");
  });

  it("keeps the dialog open and shows the server's refusal", async () => {
    svc.block.mockRejectedValue(new Error("Admins can't be blocked or deleted here."));
    const { result } = await ready();
    act(() => result.current.onBlock());
    await act(async () => result.current.dialog?.confirm());
    expect(result.current.dialog?.error).toBe("Admins can't be blocked or deleted here.");
  });
});
