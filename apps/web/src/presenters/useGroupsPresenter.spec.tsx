// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useGroupsPresenter } from "./useGroupsPresenter";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const svc = { list: vi.fn(), options: vi.fn() };
vi.mock("@/services/groups.service", () => ({
  groupsService: { list: (...a: unknown[]) => svc.list(...a), options: () => svc.options() },
}));

const group = {
  id: "g1",
  slug: "lagos-munch",
  name: "Lagos Munch",
  description: "A monthly munch.",
  category: "local",
  privacy: "open",
  country: "NG",
  state: "Lagos",
  members: 12,
  role: null,
  status: null,
};

beforeEach(() => {
  svc.list.mockReset().mockResolvedValue({ items: [group], hasMore: false });
  svc.options.mockReset().mockResolvedValue({
    categories: ["local"],
    canCreate: true,
    refusal: null,
    refusalMessage: null,
  });
});
afterEach(cleanup);

describe("useGroupsPresenter", () => {
  it("opens on popular groups, each a row that says where and how big", async () => {
    const { result } = renderHook(() => useGroupsPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(svc.list).toHaveBeenCalledWith({ view: "popular", q: "", category: null });
    expect(result.current.rows[0]).toMatchObject({
      href: "/g/lagos-munch",
      meta: "Local & meetups · Lagos, Nigeria · 12 members",
    });
    expect(result.current.create).toEqual({ label: "Create group", href: "/groups/new" });
  });

  it("points a Basic member to Silver instead of Create", async () => {
    svc.options.mockResolvedValue({
      categories: ["local"],
      canCreate: false,
      refusal: "silver",
      refusalMessage: "Creating a group is part of Silver.",
    });
    const { result } = renderHook(() => useGroupsPresenter());
    await waitFor(() =>
      expect(result.current.create).toEqual({
        label: "Get Silver to create a group",
        href: "/subscription",
      }),
    );
  });

  it("explains an empty Near you when the member has no state", async () => {
    const { result } = renderHook(() => useGroupsPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    svc.list.mockResolvedValueOnce({ items: [], hasMore: false, hint: "no_location" });
    act(() => result.current.views.find((v) => v.key === "near")?.onSelect());
    await waitFor(() =>
      expect(result.current.empty).toBe("Add your state to your profile to see groups near you."),
    );
    expect(svc.list).toHaveBeenLastCalledWith({ view: "near", q: "", category: null });
  });

  it("searches once the member stops typing, and filters by category", async () => {
    const { result } = renderHook(() => useGroupsPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.search.onChange("rope"));
    await waitFor(() =>
      expect(svc.list).toHaveBeenLastCalledWith({ view: "popular", q: "rope", category: null }),
    );
    act(() => result.current.categories.find((c) => c.key === "interests")?.onSelect());
    await waitFor(() =>
      expect(svc.list).toHaveBeenLastCalledWith({
        view: "popular",
        q: "rope",
        category: "interests",
      }),
    );
  });
});
