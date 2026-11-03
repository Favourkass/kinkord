// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSilverMembersPresenter } from "./useSilverMembersPresenter";

const list = vi.fn();
vi.mock("@/services/silverMembers.service", () => ({
  silverMembersAdminApi: { list: (...a: unknown[]) => list(...a) },
}));
vi.mock("./useAdminAccessPresenter", () => ({
  useAdminAccessPresenter: () => ({ checking: false, isAdmin: true, isFounder: false }),
}));

const page = (items: unknown[], nextPage: number | null = null) => ({
  counts: { all: 2, subscription: 1, ring: 1, given: 0 },
  items,
  nextPage,
});
const tega = {
  id: "u1",
  username: "tega",
  displayName: null,
  source: "ring",
  until: "2026-12-03T12:00:00.000Z",
  forGood: false,
  plan: null,
};
const dom = {
  ...tega,
  id: "u2",
  username: "sweetdaddydom",
  source: "subscription",
  plan: "yearly",
};

describe("useSilverMembersPresenter", () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue(page([tega, dom]));
  });

  it("lists everyone on Silver with how they got it, and counts each kind", async () => {
    const { result } = renderHook(() => useSilverMembersPresenter());
    await waitFor(() => expect(result.current.view.members).toHaveLength(2));
    expect(list).toHaveBeenCalledWith("all", "", 1);
    expect(result.current.view.members.map((m) => [m.name, m.sourceLabel])).toEqual([
      ["@tega", "Kink Ring"],
      ["@sweetdaddydom", "Subscription · yearly"],
    ]);
    expect(result.current.view.filters.map((f) => f.label)).toEqual([
      "All 2",
      "Subscription 1",
      "Kink Ring 1",
      "Given by Kinkord 0",
    ]);
  });

  it("asks again for one kind, and pages on", async () => {
    list.mockResolvedValueOnce(page([tega])).mockResolvedValueOnce(page([tega], 2));
    const { result } = renderHook(() => useSilverMembersPresenter());
    await waitFor(() => expect(result.current.view.members).toHaveLength(1));
    act(() => result.current.view.onFilter("ring"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith("ring", "", 1));
    await waitFor(() => expect(result.current.view.moreLabel).toBe("Show more"));
    list.mockResolvedValueOnce(page([dom]));
    await act(async () => result.current.view.onMore());
    expect(list).toHaveBeenLastCalledWith("ring", "", 2);
    expect(result.current.view.members).toHaveLength(2);
  });

  it("says when the list can't be loaded", async () => {
    list.mockRejectedValue(new Error("Admins only."));
    const { result } = renderHook(() => useSilverMembersPresenter());
    await waitFor(() => expect(result.current.view.error).toBe("Admins only."));
    expect(result.current.view.loading).toBeNull();
  });
});
