// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useStartChatPresenter } from "./useStartChatPresenter";

// One object for the file: a fresh router each render would re-run the effect.
const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const start = vi.fn();
vi.mock("@/services/chat.service", () => ({
  chatService: { start: (...a: unknown[]) => start(...a) },
}));

describe("useStartChatPresenter", () => {
  beforeEach(() => {
    router.replace.mockReset();
    start.mockReset();
  });
  afterEach(cleanup);

  it("opens the thread with the member and lands in it", async () => {
    start.mockResolvedValue({ conversationId: "c1" });
    renderHook(() => useStartChatPresenter("u2"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/messages/c1"));
    expect(start).toHaveBeenCalledWith("u2");
  });

  it("shows why when it can't", async () => {
    start.mockRejectedValue(new Error("You've started a lot of new conversations today."));
    const { result } = renderHook(() => useStartChatPresenter("u2"));
    await waitFor(() =>
      expect(result.current.error).toBe("You've started a lot of new conversations today."),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});
