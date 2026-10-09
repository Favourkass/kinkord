// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberCardPM } from "@/domain/member";
import { useSearchPresenter } from "./useSearchPresenter";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const search = vi.fn();
const follow = vi.fn();
const unfollow = vi.fn();
vi.mock("@/services/members.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/members.service")>()),
  membersApi: {
    search: (...a: unknown[]) => search(...a),
    follow: (...a: unknown[]) => follow(...a),
    unfollow: (...a: unknown[]) => unfollow(...a),
  },
}));

const person = (n: number, over: Partial<MemberCardPM> = {}): MemberCardPM => ({
  userId: `u${n}`,
  username: `ada${n}`,
  displayName: `Ada ${n}`,
  avatarUrl: null,
  age: 25,
  gender: "Female",
  roles: [],
  city: "Ikeja",
  state: "Lagos",
  isOnline: false,
  lastSeenAt: null,
  postsCount: 0,
  followersCount: 0,
  isFollowing: false,
  ...over,
});
const people = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => person(from + i));

beforeEach(() => {
  router.replace.mockReset();
  search
    .mockReset()
    .mockImplementation(async (q: string, page: number) =>
      q === "zed"
        ? { items: [], total: 0, page, limit: 20 }
        : { items: page === 1 ? people(1, 20) : people(21, 5), total: 25, page, limit: 20 },
    );
  follow.mockReset().mockResolvedValue({});
  unfollow.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe("useSearchPresenter", () => {
  it("waits for a search, saying what it finds", () => {
    const { result } = renderHook(() => useSearchPresenter(null));
    expect(result.current.hint).toMatch(/Find people/);
    expect(result.current.people.shown).toBe(false);
    expect(result.current.postsShown).toBe(false);
    expect(search).not.toHaveBeenCalled();
  });

  it("searches once typing pauses, keeps it in the address, and shows five people on All", async () => {
    const { result } = renderHook(() => useSearchPresenter(null));
    act(() => result.current.setQuery("a"));
    act(() => result.current.setQuery("ada"));
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("ada", 1, 20);
    expect(router.replace).toHaveBeenLastCalledWith("/search?q=ada", { scroll: false });
    expect(result.current.term).toBe("ada");
    expect(result.current.postsShown).toBe(true);
    expect(result.current.people.heading).toBe("People");
    expect(result.current.people.rows[0]).toMatchObject({ name: "Ada 1", handle: "@ada1" });
    expect(result.current.people.seeAll?.label).toBe("See all people");
  });

  it("opens everyone on the People tab, page by page, without the posts", async () => {
    const { result } = renderHook(() => useSearchPresenter("ada"));
    await waitFor(() => expect(result.current.people.seeAll).not.toBeNull());
    act(() => result.current.people.seeAll?.onClick());
    expect(result.current.tabs.find((t) => t.active)?.key).toBe("people");
    expect(result.current.people.rows).toHaveLength(20);
    expect(result.current.people.heading).toBeNull();
    expect(result.current.postsShown).toBe(false);
    expect(result.current.people.hasMore).toBe(true);
    act(() => result.current.people.onLoadMore());
    await waitFor(() => expect(result.current.people.rows).toHaveLength(25));
    expect(search).toHaveBeenLastCalledWith("ada", 2, 20);
    expect(result.current.people.hasMore).toBe(false);
  });

  it("shows only the posts on the Posts tab", async () => {
    const { result } = renderHook(() => useSearchPresenter("ada"));
    act(() => result.current.setTab("posts"));
    expect(result.current.people.shown).toBe(false);
    expect(result.current.postsShown).toBe(true);
    expect(result.current.postsHeading).toBeNull();
    expect(result.current.postsEmpty).toBe("No posts contain “ada”.");
  });

  it("says when nobody matches", async () => {
    const { result } = renderHook(() => useSearchPresenter("zed"));
    await waitFor(() => expect(result.current.people.empty).toBe("No people match “zed”."));
    expect(result.current.people.seeAll).toBeNull();
  });

  it("follows at once, and takes it back when the API refuses", async () => {
    follow.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useSearchPresenter("ada"));
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    act(() => result.current.people.onToggleFollow("u1"));
    expect(result.current.people.rows[0]).toMatchObject({ isFollowing: true, busy: true });
    expect(follow).toHaveBeenCalledWith("ada1");
    await waitFor(() => expect(result.current.people.rows[0].busy).toBe(false));
    expect(result.current.people.rows[0].isFollowing).toBe(false);
  });

  it("clears at once, back to the hint, and keeps the address in step", async () => {
    const { result } = renderHook(() => useSearchPresenter("ada"));
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    act(() => result.current.clear());
    await waitFor(() => expect(result.current.term).toBe(""));
    expect(result.current.hint).not.toBeNull();
    expect(result.current.people.shown).toBe(false);
    expect(router.replace).toHaveBeenLastCalledWith("/search", { scroll: false });
  });

  it("never searches more than the API takes", async () => {
    const { result } = renderHook(() => useSearchPresenter(null));
    act(() => result.current.setQuery("a".repeat(80)));
    expect(result.current.query).toHaveLength(50);
    await waitFor(() => expect(search).toHaveBeenCalledWith("a".repeat(50), 1, 20));
  });
});
