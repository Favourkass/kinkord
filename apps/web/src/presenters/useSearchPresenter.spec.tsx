// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberCardPM } from "@/domain/member";
import { clip, useSearchPresenter } from "./useSearchPresenter";

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

  it("clears the error once a retried page of people arrives", async () => {
    const { result } = renderHook(() => useSearchPresenter("ada"));
    await waitFor(() => expect(result.current.people.seeAll).not.toBeNull());
    act(() => result.current.people.seeAll?.onClick());
    search.mockRejectedValueOnce(new Error("offline"));
    act(() => result.current.people.onLoadMore());
    await waitFor(() =>
      expect(result.current.people.error).toBe("Search isn’t working right now. Try again."),
    );
    act(() => result.current.people.onLoadMore());
    await waitFor(() => expect(result.current.people.rows).toHaveLength(25));
    expect(result.current.people.error).toBeNull();
  });

  it("drops a page of an earlier round of the same search", async () => {
    let release: (page: unknown) => void = () => undefined;
    const { result, rerender } = renderHook(
      ({ q }: { q: string | null }) => useSearchPresenter(q),
      {
        initialProps: { q: "ada" as string | null },
      },
    );
    await waitFor(() => expect(result.current.people.seeAll).not.toBeNull());
    act(() => result.current.people.seeAll?.onClick());
    search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    act(() => result.current.people.onLoadMore());
    // Away and back: a fresh first page of the same words.
    rerender({ q: "zed" });
    rerender({ q: "ada" });
    await waitFor(() => expect(result.current.people.rows).toHaveLength(20));
    await act(async () => release({ items: people(21, 5), total: 25, page: 2, limit: 20 }));
    expect(result.current.people.rows).toHaveLength(20);
    // The next page asked for is still page 2, not one past the dropped page.
    act(() => result.current.people.onLoadMore());
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("ada", 2, 20));
  });

  it("keeps a follow that went through, even after the rows refreshed", async () => {
    let accept: (v: unknown) => void = () => undefined;
    follow.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          accept = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ q }: { q: string | null }) => useSearchPresenter(q),
      {
        initialProps: { q: "ada" as string | null },
      },
    );
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    act(() => result.current.people.onToggleFollow("u1"));
    rerender({ q: "zed" });
    rerender({ q: "ada" });
    // The fresh rows were read before the follow landed, yet still show it.
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("ada", 1, 20));
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    expect(result.current.people.rows[0].isFollowing).toBe(true);
    await act(async () => accept({}));
    await waitFor(() => expect(result.current.people.rows[0].busy).toBe(false));
    expect(result.current.people.rows[0].isFollowing).toBe(true);
  });

  it("keeps a follow that landed before an older search's results arrived", async () => {
    let accept: (v: unknown) => void = () => undefined;
    follow.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          accept = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ q }: { q: string | null }) => useSearchPresenter(q),
      {
        initialProps: { q: "ada" as string | null },
      },
    );
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    // Follow, then refine the search while the follow is still out.
    act(() => result.current.people.onToggleFollow("u1"));
    let respond: (page: unknown) => void = () => undefined;
    search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    rerender({ q: "ada1" });
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("ada1", 1, 20));
    // The follow lands first; the refined search was read before it did.
    await act(async () => accept({}));
    await act(async () => respond({ items: [person(1)], total: 1, page: 1, limit: 20 }));
    expect(result.current.people.rows[0]).toMatchObject({ handle: "@ada1", isFollowing: true });
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

  it("follows the address when it changes under the page: the Search link, Back, Forward", async () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string | null }) => useSearchPresenter(q),
      {
        initialProps: { q: "ada" as string | null },
      },
    );
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    // The header's Search link: /search with nothing in it.
    rerender({ q: null });
    expect(result.current.query).toBe("");
    expect(result.current.term).toBe("");
    expect(result.current.hint).not.toBeNull();
    // Back to an earlier search.
    rerender({ q: "zed" });
    expect(result.current.query).toBe("zed");
    await waitFor(() => expect(result.current.people.empty).toBe("No people match “zed”."));
  });

  it("never undoes typing when its own address change comes back", async () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string | null }) => useSearchPresenter(q),
      {
        initialProps: { q: null as string | null },
      },
    );
    act(() => result.current.setQuery("ada"));
    await waitFor(() => expect(result.current.term).toBe("ada"));
    act(() => result.current.setQuery("ada ok"));
    // The page re-renders with ?q=ada (from our replace) while "ada ok" is still being typed.
    rerender({ q: "ada" });
    expect(result.current.query).toBe("ada ok");
  });

  it("undoes a refused follow to exactly how it was, even after the rows refreshed", async () => {
    let refuse: (e: Error) => void = () => undefined;
    follow.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          refuse = reject;
        }),
    );
    const { result, rerender } = renderHook(
      ({ q }: { q: string | null }) => useSearchPresenter(q),
      {
        initialProps: { q: "ada" as string | null },
      },
    );
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    act(() => result.current.people.onToggleFollow("u1"));
    expect(result.current.people.rows[0].isFollowing).toBe(true);
    // Another search, then back: fresh rows from the API while the follow is still out.
    rerender({ q: "zed" });
    rerender({ q: "ada" });
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    await act(async () => refuse(new Error("offline")));
    await waitFor(() => expect(result.current.people.rows[0].busy).toBe(false));
    expect(result.current.people.rows[0].isFollowing).toBe(false);
  });

  it("never cuts an emoji in half at the limit, so the address stays valid", async () => {
    const q = `${"a".repeat(49)}😀`;
    expect(clip(q)).toBe("a".repeat(49));
    expect(clip("hi 😀")).toBe("hi 😀");
    const { result } = renderHook(() => useSearchPresenter(q));
    expect(result.current.term).toBe("a".repeat(49));
    await waitFor(() =>
      expect(router.replace).toHaveBeenLastCalledWith(`/search?q=${"a".repeat(49)}`, {
        scroll: false,
      }),
    );
  });

  it("never lets another search's slow page hold up this one's", async () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string | null }) => useSearchPresenter(q),
      {
        initialProps: { q: "ada" as string | null },
      },
    );
    await waitFor(() => expect(result.current.people.seeAll).not.toBeNull());
    act(() => result.current.people.seeAll?.onClick());
    search.mockImplementationOnce(() => new Promise(() => undefined));
    act(() => result.current.people.onLoadMore());
    expect(result.current.people.loadingMore).toBe(true);
    rerender({ q: "bob" });
    await waitFor(() => expect(result.current.people.rows).toHaveLength(20));
    expect(result.current.people.loadingMore).toBe(false);
    act(() => result.current.people.onLoadMore());
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("bob", 2, 20));
  });

  it("trusts a search asked for after a follow settled", async () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string | null }) => useSearchPresenter(q),
      {
        initialProps: { q: "ada" as string | null },
      },
    );
    await waitFor(() => expect(result.current.people.rows).toHaveLength(5));
    act(() => result.current.people.onToggleFollow("u1"));
    await waitFor(() => expect(result.current.people.rows[0].busy).toBe(false));
    expect(result.current.people.rows[0].isFollowing).toBe(true);
    // Unfollowed in another tab since: a fresh search says so, and wins.
    rerender({ q: "ada1" });
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("ada1", 1, 20));
    await waitFor(() => expect(result.current.people.rows[0]?.handle).toBe("@ada1"));
    expect(result.current.people.rows[0].isFollowing).toBe(false);
  });

  it("can't page the same words typed again until their fresh people are in", async () => {
    const { result } = renderHook(() => useSearchPresenter("ada"));
    await waitFor(() => expect(result.current.people.seeAll).not.toBeNull());
    act(() => result.current.people.seeAll?.onClick());
    let respond: (page: unknown) => void = () => undefined;
    search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    act(() => result.current.clear());
    await waitFor(() => expect(result.current.term).toBe(""));
    act(() => result.current.setQuery("ada"));
    await waitFor(() => expect(result.current.term).toBe("ada"));
    expect(result.current.people.loading).toBe(true);
    expect(result.current.people.hasMore).toBe(false);
    act(() => result.current.people.onLoadMore());
    expect(search).not.toHaveBeenCalledWith("ada", 2, 20);
    await act(async () => respond({ items: people(1, 20), total: 25, page: 1, limit: 20 }));
    expect(result.current.people.rows).toHaveLength(20);
    expect(result.current.people.hasMore).toBe(true);
  });

  it("never shows anyone twice when the list shifts between pages", async () => {
    search.mockImplementation(async (_q: string, page: number) => ({
      // Page two starts with the last of page one: someone moved across the boundary.
      items: page === 1 ? people(1, 20) : people(20, 6),
      total: 25,
      page,
      limit: 20,
    }));
    const { result } = renderHook(() => useSearchPresenter("ada"));
    await waitFor(() => expect(result.current.people.seeAll).not.toBeNull());
    act(() => result.current.people.seeAll?.onClick());
    act(() => result.current.people.onLoadMore());
    await waitFor(() => expect(result.current.people.rows).toHaveLength(25));
    expect(new Set(result.current.people.rows.map((r) => r.userId)).size).toBe(25);
    expect(result.current.people.hasMore).toBe(false);
  });

  it("stops asking once the pages run out, even when a repeat was skipped", async () => {
    search.mockImplementation(async (_q: string, page: number) => ({
      // Page two is the end, but its first person was already on page one.
      items: page === 1 ? people(1, 20) : people(20, 5),
      total: 24,
      page,
      limit: 20,
    }));
    const { result } = renderHook(() => useSearchPresenter("ada"));
    await waitFor(() => expect(result.current.people.seeAll).not.toBeNull());
    act(() => result.current.people.seeAll?.onClick());
    act(() => result.current.people.onLoadMore());
    await waitFor(() => expect(result.current.people.rows).toHaveLength(24));
    expect(result.current.people.hasMore).toBe(false);
  });

  it("never searches more than the API takes", async () => {
    const { result } = renderHook(() => useSearchPresenter(null));
    act(() => result.current.setQuery("a".repeat(80)));
    expect(result.current.query).toHaveLength(50);
    await waitFor(() => expect(search).toHaveBeenCalledWith("a".repeat(50), 1, 20));
  });
});
