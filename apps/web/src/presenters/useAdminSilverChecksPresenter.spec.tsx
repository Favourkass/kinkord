// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HeldCheckPM } from "@/domain/subscription";
import { useAdminSilverChecksPresenter } from "./useAdminSilverChecksPresenter";

const held = vi.fn();
const approve = vi.fn();
vi.mock("@/services/subscription.service", () => ({
  silverChecksAdminService: {
    held: () => held(),
    approve: (...a: unknown[]) => approve(...a),
  },
}));

const row = (userId: string, over: Partial<HeldCheckPM> = {}): HeldCheckPM => ({
  userId,
  username: `m_${userId}`,
  displayName: `Member ${userId}`,
  avatarUrl: null,
  reason: "name",
  heldAt: "2026-10-07T09:00:00Z",
  silverUntil: "2027-10-06T12:00:00Z",
  ...over,
});

beforeEach(() => {
  held.mockReset().mockResolvedValue([row("u1"), row("u2", { reason: "photo" })]);
  approve.mockReset().mockResolvedValue({ userId: "u1" });
});
afterEach(cleanup);

describe("useAdminSilverChecksPresenter", () => {
  it("waits for admin access before loading", () => {
    const { result } = renderHook(() => useAdminSilverChecksPresenter(false));
    expect(held).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("lists the checks with what changed and links to each member", async () => {
    const { result } = renderHook(() => useAdminSilverChecksPresenter(true));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.rows[0]).toMatchObject({
      name: "Member u1",
      handle: "@m_u1",
      change: "New name",
      href: "/moderation/members/u1",
      busy: false,
    });
    expect(result.current.rows[1].change).toBe("New photo");
    expect(result.current.empty).toBe(false);
  });

  it("approves a check and takes it off the list", async () => {
    const { result } = renderHook(() => useAdminSilverChecksPresenter(true));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.onApprove("u1"));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(approve).toHaveBeenCalledWith("u1");
    expect(result.current.notice).toBe("Approved. Member u1's check shows again.");
  });

  it("keeps the row and says why when approving fails", async () => {
    approve.mockRejectedValue(new Error("This member's check isn't waiting for review."));
    const { result } = renderHook(() => useAdminSilverChecksPresenter(true));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.onApprove("u1"));
    await waitFor(() =>
      expect(result.current.error).toBe("This member's check isn't waiting for review."),
    );
    expect(result.current.rows).toHaveLength(2);
  });

  it("says so when nothing waits", async () => {
    held.mockResolvedValue([]);
    const { result } = renderHook(() => useAdminSilverChecksPresenter(true));
    await waitFor(() => expect(result.current.empty).toBe(true));
  });
});
