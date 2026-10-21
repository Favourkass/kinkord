// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST_TAGS_MAX, type TagSuggestionPM } from "@/domain/post";
import { useTagPicker } from "./useTagPicker";

const tagSuggestions = vi.fn();
vi.mock("@/services/posts.service", () => ({
  postsApi: { tagSuggestions: (...a: unknown[]) => tagSuggestions(...a) },
}));

const friend = (n: number): TagSuggestionPM => ({
  userId: `u${n}`,
  username: `friend_${n}`,
  displayName: `Friend ${n}`,
  avatarUrl: null,
});

beforeEach(() => {
  tagSuggestions.mockReset().mockResolvedValue({ items: [friend(1), friend(2)] });
});
afterEach(cleanup);

describe("useTagPicker", () => {
  it("searches nothing until the panel is open in an open composer", async () => {
    const { result, rerender } = renderHook(({ enabled }) => useTagPicker(enabled), {
      initialProps: { enabled: false },
    });
    act(() => result.current.vm.onOpen());
    await new Promise((r) => setTimeout(r, 300));
    expect(tagSuggestions).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.vm.results).toHaveLength(2));
    expect(tagSuggestions).toHaveBeenCalledWith("");
  });

  it("searches as the viewer types, once the typing settles", async () => {
    const { result } = renderHook(() => useTagPicker(true));
    act(() => result.current.vm.onOpen());
    act(() => result.current.vm.setQuery("Fr"));
    act(() => result.current.vm.setQuery("Fri"));
    expect(result.current.vm.loading).toBe(true);
    await waitFor(() => expect(result.current.vm.loading).toBe(false));
    expect(tagSuggestions).toHaveBeenLastCalledWith("fri");
    expect(tagSuggestions).toHaveBeenCalledTimes(1);
  });

  it("tags a friend once, offers them no more, and sends their username", async () => {
    const { result } = renderHook(() => useTagPicker(true));
    act(() => result.current.vm.onOpen());
    await waitFor(() => expect(result.current.vm.results).toHaveLength(2));
    act(() => result.current.vm.results[0].onPick());
    expect(result.current.vm.chips.map((c) => c.name)).toEqual(["Friend 1"]);
    expect(result.current.vm.results.map((r) => r.name)).toEqual(["Friend 2"]);
    act(() => result.current.vm.results[0].onPick());
    // Everyone who matched is tagged now: nothing to offer, but no "no match" either.
    await waitFor(() => expect(result.current.vm.loading).toBe(false));
    expect(result.current.vm.results).toEqual([]);
    expect(result.current.vm.empty).toBe(false);
    act(() => result.current.vm.chips[1].onRemove());
    expect(result.current.usernames).toEqual(["friend_1"]);
    act(() => result.current.vm.chips[0].onRemove());
    expect(result.current.usernames).toEqual([]);
  });

  it(`stops at ${POST_TAGS_MAX} people`, async () => {
    tagSuggestions.mockResolvedValue({
      items: Array.from({ length: POST_TAGS_MAX + 1 }, (_, i) => friend(i)),
    });
    const { result } = renderHook(() => useTagPicker(true));
    act(() => result.current.vm.onOpen());
    await waitFor(() => expect(result.current.vm.results).toHaveLength(POST_TAGS_MAX + 1));
    for (let i = 0; i <= POST_TAGS_MAX; i++) act(() => result.current.vm.results[0]?.onPick());
    expect(result.current.vm.chips).toHaveLength(POST_TAGS_MAX);
    expect(result.current.vm.full).toBe(true);
  });

  it("says when no friend matches, and starts over on reset", async () => {
    tagSuggestions.mockResolvedValue({ items: [] });
    const { result } = renderHook(() => useTagPicker(true));
    act(() => result.current.vm.onOpen());
    await waitFor(() => expect(result.current.vm.empty).toBe(true));
    act(() => result.current.reset());
    expect(result.current.vm.open).toBe(false);
    expect(result.current.vm.query).toBe("");
  });
});
