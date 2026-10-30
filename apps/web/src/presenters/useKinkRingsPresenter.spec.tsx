// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { kinkRingsApi } from "@/services/kinkRings.service";
import { useKinkRingsPresenter } from "./useKinkRingsPresenter";
import { ApiError } from "@/services/apiClient";
const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/kinkRings.service", async (original) => ({
  ...(await original<typeof import("@/services/kinkRings.service")>()),
  kinkRingsApi: {
    inventory: vi.fn(),
    recipients: vi.fn(),
    giveSelected: vi.fn(),
    history: vi.fn(),
    expired: vi.fn(),
  },
}));
const rings = {
  available: [1, 2].map((i) => ({
    id: `r${i}`,
    createdAt: "2026-10-01T12:00:00Z",
    expiresAt: "2090-11-01T12:00:00Z",
    source: "purchase" as const,
  })),
  expired: { items: [], total: 0, nextPage: null },
  history: { items: [], nextPage: null },
};
const ada = {
  userId: "a",
  username: "ada",
  name: "Ada",
  avatarUrl: null,
  city: null,
  country: null,
  online: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(kinkRingsApi.inventory).mockResolvedValue(rings);
  vi.mocked(kinkRingsApi.recipients).mockResolvedValue({ items: [ada], nextPage: null });
  vi.mocked(kinkRingsApi.giveSelected).mockResolvedValue({ gifts: [] });
});
async function loaded() {
  const hook = renderHook(() => useKinkRingsPresenter());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}
async function selected() {
  const h = await loaded();
  act(() => h.result.current.onGift());
  await waitFor(() => expect(h.result.current.recipients).toHaveLength(1));
  act(() => h.result.current.onRecipient("a"));
  act(() => h.result.current.onContinue());
  expect(h.result.current.stage).toBe("selected");
  act(() => h.result.current.onContinue());
  expect(h.result.current.stage).toBe("allocation");
  act(() => h.result.current.onContinue());
  expect(h.result.current.stage).toBe("message");
  act(() => h.result.current.onContinue());
  return h;
}
it("opens inventory from the available count and selects a specific ring", async () => {
  const { result } = await loaded();
  expect(result.current.count).toBe(2);
  act(() => result.current.onInventory());
  expect(result.current.stage).toBe("inventory");
  act(() => result.current.onGiftRing("r2"));
  expect(result.current.selectedCount).toBe(1);
  expect(result.current.inventoryRemaining).toBe(2);
  expect(result.current.stage).toBe("recipients");
  expect(kinkRingsApi.giveSelected).not.toHaveBeenCalled();
});
it("reviews quantities before sending explicit rings and prevents duplicate clicks", async () => {
  const { result } = await selected();
  expect(result.current.stage).toBe("review");
  expect(kinkRingsApi.giveSelected).not.toHaveBeenCalled();
  act(() => result.current.onQuantity("a", 2));
  let resolve!: (v: { gifts: [] }) => void;
  vi.mocked(kinkRingsApi.giveSelected).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  act(() => {
    void result.current.onGive();
    void result.current.onGive();
  });
  expect(kinkRingsApi.giveSelected).toHaveBeenCalledTimes(1);
  expect(kinkRingsApi.giveSelected).toHaveBeenCalledWith([
    { ringId: "r1", username: "ada" },
    { ringId: "r2", username: "ada" },
  ]);
  await act(async () => resolve({ gifts: [] }));
  expect(result.current.stage).toBe("overview");
});
it("retains the same assignment after a network error so retry cannot consume other rings", async () => {
  vi.mocked(kinkRingsApi.giveSelected).mockRejectedValueOnce(new Error("offline"));
  const { result } = await selected();
  await act(() => result.current.onGive());
  expect(result.current.stage).toBe("review");
  expect(result.current.picked[0].username).toBe("ada");
  await act(() => result.current.onGive());
  const calls = vi.mocked(kinkRingsApi.giveSelected).mock.calls;
  expect(calls[0]).toEqual(calls[1]);
});
it("does not present a completed gift as failed if balance refresh fails", async () => {
  const { result } = await selected();
  vi.mocked(kinkRingsApi.inventory).mockRejectedValueOnce(new Error("offline"));
  await act(() => result.current.onGive());
  expect(result.current.stage).toBe("overview");
  expect(result.current.note).toContain("gifted");
  expect(result.current.giveError).toBeNull();
  expect(result.current.count).toBe(1);
});
it("does not allow quantities beyond the selected ring budget", async () => {
  const { result } = await selected();
  act(() => result.current.onQuantity("a", 3));
  expect(result.current.quantityTotal).toBe(1);
  act(() => result.current.onRemove("a"));
  expect(result.current.canContinue).toBe(false);
});
it("redirects signed-out members", async () => {
  vi.mocked(kinkRingsApi.inventory).mockRejectedValueOnce(new ApiError(401, null));
  renderHook(() => useKinkRingsPresenter());
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
});

it("retries the identical gift when a ring expires after an uncertain response", async () => {
  const { result, unmount } = await selected();
  vi.mocked(kinkRingsApi.giveSelected).mockRejectedValueOnce(new Error("offline"));
  await act(() => result.current.onGive());
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2091-01-01T12:00:00Z"));
    // The real interval also ticks after 30s; reload updates the presenter's clock immediately.
    await act(() => result.current.onRetry());
    expect(result.current.count).toBe(0);
    expect(result.current.expiredCount).toBe(2);
    expect(result.current.canSubmit).toBe(true);
    await act(() => result.current.onGive());
    expect(vi.mocked(kinkRingsApi.giveSelected).mock.calls[0]).toEqual(
      vi.mocked(kinkRingsApi.giveSelected).mock.calls[1],
    );
  } finally {
    unmount();
    vi.useRealTimers();
  }
});

it("keeps unselected rings in the inventory remainder", async () => {
  const { result } = await loaded();
  act(() => result.current.onGiftRing("r1"));
  await waitFor(() => expect(result.current.recipients).toHaveLength(1));
  act(() => result.current.onRecipient("a"));
  expect(result.current.remaining).toBe(0);
  expect(result.current.inventoryRemaining).toBe(1);
});

it("preserves ring swaps and individual messages through review and editing", async () => {
  vi.mocked(kinkRingsApi.recipients).mockResolvedValue({
    items: [ada, { ...ada, userId: "b", username: "bob", name: "Bob" }],
    nextPage: null,
  });
  const { result } = await loaded();
  act(() => result.current.onGift());
  await waitFor(() => expect(result.current.recipients).toHaveLength(2));
  act(() => result.current.onRecipient("a"));
  act(() => result.current.onRecipient("b"));
  act(() => result.current.onContinue());
  act(() => result.current.onContinue());
  act(() => result.current.onRing("a", 0, "r2"));
  expect(result.current.picked[1].rings[0].id).toBe("r1");
  act(() => result.current.onContinue());
  act(() => result.current.onMessage("a", "Enjoy! 💛"));
  act(() => result.current.onMessage("b", "Thanks, Bob"));
  act(() => result.current.onContinue());
  expect(result.current.stage).toBe("review");
  expect(kinkRingsApi.giveSelected).not.toHaveBeenCalled();
  act(() => result.current.onEditRecipients());
  expect(result.current.picked[0].message).toBe("Enjoy! 💛");
  act(() => result.current.onContinue());
  act(() => result.current.onContinue());
  act(() => result.current.onContinue());
  await act(() => result.current.onGive());
  expect(kinkRingsApi.giveSelected).toHaveBeenCalledWith([
    { ringId: "r2", username: "ada", message: "Enjoy! 💛" },
    { ringId: "r1", username: "bob", message: "Thanks, Bob" },
  ]);
});
