// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KinkRingsPM } from "@/domain/kinkRings";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const mine = vi.fn();
const give = vi.fn();
vi.mock("@/services/kinkRings.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/kinkRings.service")>()),
  kinkRingsApi: {
    mine: (...a: unknown[]) => mine(...a),
    give: (...a: unknown[]) => give(...a),
  },
}));

const search = vi.fn();
vi.mock("@/services/members.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/members.service")>();
  return {
    ...original,
    membersApi: { ...original.membersApi, search: (...a: unknown[]) => search(...a) },
  };
});

const { useKinkRingsPresenter } = await import("./useKinkRingsPresenter");
const { ApiError } = await import("@/services/apiClient");

const rings = (n: number): KinkRingsPM => ({
  available: Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    expiresAt: `2026-1${i + 1}-26T12:00:00.000Z`,
  })),
  given: [],
});

const ada = {
  userId: "u-ada",
  username: "ada",
  displayName: "Ada",
  avatarUrl: null,
  age: null,
  gender: null,
  roles: [],
  city: null,
  state: null,
  isOnline: false,
  lastSeenAt: null,
};

beforeEach(() => {
  replace.mockReset();
  mine.mockReset().mockResolvedValue(rings(2));
  give
    .mockReset()
    .mockResolvedValue({ ringId: "r0", to: { username: "ada", displayName: "Ada" }, left: 1 });
  search.mockReset().mockResolvedValue({ items: [ada], total: 1, page: 1, limit: 6 });
});

const loaded = async () => {
  const hook = renderHook(() => useKinkRingsPresenter());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe("useKinkRingsPresenter", () => {
  it("shows the member's rings, each with when it expires", async () => {
    const { result } = await loaded();
    expect(result.current.vm?.heading).toBe("You have 2 Kink Rings to give");
    expect(result.current.vm?.rings[0].expires).toBe("Expires 26 Nov 2026");
    expect(result.current.canGive).toBe(true);
  });

  it("points a member with no rings to Silver instead of offering to give", async () => {
    mine.mockResolvedValueOnce(rings(0));
    const { result } = await loaded();
    expect(result.current.canGive).toBe(false);
    expect(result.current.vm?.heading).toBe("You have no Kink Rings to give");
    expect(result.current.none.href).toBe("/subscription");
  });

  it("finds members once two letters are typed, then gives the picked one a ring", async () => {
    const { result } = await loaded();
    act(() => result.current.search.onChange("a"));
    expect(result.current.search.status).toBeNull();
    act(() => result.current.search.onChange("ad"));
    expect(result.current.search.status).toBe("Searching…");
    await waitFor(() => expect(result.current.search.results).toHaveLength(1));
    expect(search).toHaveBeenCalledWith("ad", 1, 6);
    expect(result.current.search.results[0]).toEqual({
      userId: "u-ada",
      name: "Ada",
      handle: "@ada",
      avatarUrl: null,
    });

    act(() => result.current.search.onPick("u-ada"));
    expect(result.current.picked?.name).toBe("Ada");
    expect(result.current.confirm).toBe("Give Ada a Kink Ring? They get a month of Silver.");

    mine.mockResolvedValueOnce(rings(1));
    await act(() => result.current.onGive());
    expect(give).toHaveBeenCalledWith("ada");
    expect(result.current.note).toBe("Ring given. Ada has a month of Silver.");
    expect(result.current.picked).toBeNull();
    expect(result.current.vm?.count).toBe(1);
  });

  it("keeps the pick and says why when the API refuses", async () => {
    give.mockRejectedValueOnce(new ApiError(400, { message: "Ada already has Silver for good." }));
    const { result } = await loaded();
    act(() => result.current.search.onChange("ada"));
    await waitFor(() => expect(result.current.search.results).toHaveLength(1));
    act(() => result.current.search.onPick("u-ada"));
    await act(() => result.current.onGive());
    expect(result.current.giveError).toBe("Ada already has Silver for good.");
    expect(result.current.picked?.name).toBe("Ada");
    act(() => result.current.onCancel());
    expect(result.current.picked).toBeNull();
    expect(result.current.giveError).toBeNull();
  });

  it("sends a signed-out member to log in", async () => {
    mine.mockRejectedValueOnce(new ApiError(401, null));
    renderHook(() => useKinkRingsPresenter());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("says when the rings can't be read", async () => {
    mine.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useKinkRingsPresenter());
    await waitFor(() =>
      expect(result.current.error).toBe("Couldn't load your Kink Rings. Refresh to try again."),
    );
  });
});
