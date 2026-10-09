// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberCardPM } from "@/domain/member";
import { useMentionSuggestions } from "./useMentionSuggestions";

const search = vi.fn();
vi.mock("@/services/members.service", () => ({
  membersApi: { search: (...a: unknown[]) => search(...a) },
}));

const member = (n: number, over: Partial<MemberCardPM> = {}): MemberCardPM => ({
  userId: `u${n}`,
  username: `ada${n}`,
  displayName: `Ada ${n}`,
  avatarUrl: null,
  age: null,
  gender: null,
  roles: [],
  city: null,
  state: null,
  isOnline: false,
  lastSeenAt: null,
  postsCount: 0,
  followersCount: 0,
  isFollowing: false,
  ...over,
});

const setText = vi.fn();

beforeEach(() => {
  setText.mockReset();
  search.mockReset().mockResolvedValue({
    items: [member(1), member(2, { username: null }), member(3)],
    total: 3,
    page: 1,
    limit: 6,
  });
});
afterEach(cleanup);

describe("useMentionSuggestions", () => {
  it("suggests members with a username for the @ being typed, in that box only", async () => {
    const { result } = renderHook(() => useMentionSuggestions(setText));
    act(() => result.current.track("comment", "hi @ad", 6));
    await waitFor(() => expect(result.current.picker("comment", 1000).open).toBe(true));
    expect(search).toHaveBeenCalledWith("ad", 1, 6);
    expect(result.current.picker("comment", 1000).items.map((s) => s.username)).toEqual([
      "ada1",
      "ada3",
    ]);
    expect(result.current.picker("post", 1000).open).toBe(false);
  });

  it("asks nothing for a bare @, and closes once the caret leaves the handle", async () => {
    const { result } = renderHook(() => useMentionSuggestions(setText));
    act(() => result.current.track("post", "@", 1));
    await new Promise((r) => setTimeout(r, 200));
    expect(search).not.toHaveBeenCalled();
    act(() => result.current.track("post", "hi @ada", 7));
    await waitFor(() => expect(result.current.picker("post", 1000).open).toBe(true));
    act(() => result.current.track("post", "hi @ada ", 8));
    expect(result.current.picker("post", 1000).open).toBe(false);
  });

  it("moves with the arrows, picks with Enter, and puts the caret after the mention", async () => {
    const { result } = renderHook(() => useMentionSuggestions(setText));
    act(() => result.current.track("post", "lunch @ad", 9));
    await waitFor(() => expect(result.current.picker("post", 1000).open).toBe(true));
    let handled = false;
    act(() => {
      handled = result.current.picker("post", 1000).onKey("ArrowDown");
    });
    expect(handled).toBe(true);
    expect(result.current.picker("post", 1000).highlighted).toBe(1);
    act(() => {
      result.current.picker("post", 1000).onKey("Enter");
    });
    expect(setText).toHaveBeenCalledWith("post", "lunch @ada3 ");
    expect(result.current.picker("post", 1000).open).toBe(false);
    expect(result.current.picker("post", 1000).caret).toEqual({ at: 12, pick: 1 });
  });

  it("leaves keys alone when no list is open, and Escape closes one", async () => {
    const { result } = renderHook(() => useMentionSuggestions(setText));
    expect(result.current.picker("comment", 1000).onKey("Enter")).toBe(false);
    act(() => result.current.track("comment", "@ad", 3));
    await waitFor(() => expect(result.current.picker("comment", 1000).open).toBe(true));
    act(() => {
      result.current.picker("comment", 1000).onKey("Escape");
    });
    expect(result.current.picker("comment", 1000).open).toBe(false);
    expect(setText).not.toHaveBeenCalled();
  });

  it("leaves out a pick that would take the box past its limit", async () => {
    const { result } = renderHook(() => useMentionSuggestions(setText));
    act(() => result.current.track("comment", "@ad", 3));
    await waitFor(() => expect(result.current.picker("comment", 5).open).toBe(true));
    // "@ada1 " is 6 characters: one past this box's limit.
    act(() => result.current.picker("comment", 5).onPick("ada1"));
    expect(setText).not.toHaveBeenCalled();
    expect(result.current.picker("comment", 5).open).toBe(false);
  });

  it("closes a box's list when its draft is cleared, so a pick can't bring the text back", async () => {
    const { result } = renderHook(() => useMentionSuggestions(setText));
    act(() => result.current.track("comment", "sent @ad", 8));
    await waitFor(() => expect(result.current.picker("comment", 1000).open).toBe(true));
    act(() => result.current.close("post"));
    expect(result.current.picker("comment", 1000).open).toBe(true);
    act(() => result.current.close("comment"));
    expect(result.current.picker("comment", 1000).open).toBe(false);
  });

  it("picks by tap too", async () => {
    const { result } = renderHook(() => useMentionSuggestions(setText));
    act(() => result.current.track("comment", "@ad", 3));
    await waitFor(() => expect(result.current.picker("comment", 1000).open).toBe(true));
    act(() => result.current.picker("comment", 1000).onPick("ada1"));
    expect(setText).toHaveBeenCalledWith("comment", "@ada1 ");
  });
});
