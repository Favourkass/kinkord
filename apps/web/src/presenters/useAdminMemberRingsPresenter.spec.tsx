// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { MemberRingsPM } from "@/domain/kinkRings";
import { useAdminMemberRingsPresenter } from "./useAdminMemberRingsPresenter";

const forMember = vi.fn();
const cancelUnused = vi.fn();
const cancelSilver = vi.fn();
vi.mock("@/services/kinkRings.service", () => ({
  kinkRingsAdminApi: {
    forMember: (...a: unknown[]) => forMember(...a),
    cancelUnused: (...a: unknown[]) => cancelUnused(...a),
    cancelSilver: (...a: unknown[]) => cancelSilver(...a),
  },
}));

const rings: MemberRingsPM = {
  counts: { total: 12, unused: 9, given: 2, expired: 1, cancelled: 0, received: 0 },
  batches: [
    {
      paymentId: "pay-1",
      period: "yearly",
      confirmedAt: "2026-10-01T09:00:00.000Z",
      rings: [
        {
          id: "r2",
          seq: 2,
          status: "given",
          expiresAt: "2026-11-30T09:00:00.000Z",
          givenAt: "2026-10-29T15:00:00.000Z",
          recipient: { id: "u2", username: "tega", displayName: "Tega" },
          recipientLeft: false,
          withNote: false,
          silverCancelled: false,
        },
      ],
    },
  ],
  received: [],
};

describe("useAdminMemberRingsPresenter", () => {
  beforeEach(() => {
    forMember.mockReset().mockResolvedValue(rings);
    cancelUnused.mockReset();
    cancelSilver.mockReset();
  });

  it("shows a member's rings, each linking to whoever received it", async () => {
    const { result } = renderHook(() => useAdminMemberRingsPresenter("u1", true));
    expect(result.current.loading).toBe("Loading Kink Rings…");
    await waitFor(() => expect(result.current.vm).not.toBeNull());
    expect(forMember).toHaveBeenCalledWith("u1");
    expect(result.current.vm?.summary).toBe(
      "Balance: 9 to give · 12 rings in all · 2 given · 1 expired · 0 received",
    );
    expect(result.current.vm?.batches[0].rings[0]).toMatchObject({
      line: "To @tega (Tega) on 29 Oct 2026",
      href: "/moderation/members/u2",
    });
    expect(result.current.loading).toBeNull();
  });

  it("loads nothing for someone who isn't an admin", () => {
    const { result } = renderHook(() => useAdminMemberRingsPresenter("u1", false));
    expect(forMember).not.toHaveBeenCalled();
    expect(result.current.loading).toBeNull();
  });

  it("says when the rings can't be loaded", async () => {
    forMember.mockRejectedValue(new Error("Admins only."));
    const { result } = renderHook(() => useAdminMemberRingsPresenter("u1", true));
    await waitFor(() => expect(result.current.error).toBe("Admins only."));
    expect(result.current.loading).toBeNull();
  });

  it("never shows one member's rings on another's page", async () => {
    const { result, rerender } = renderHook(({ id }) => useAdminMemberRingsPresenter(id, true), {
      initialProps: { id: "u1" },
    });
    await waitFor(() => expect(result.current.vm).not.toBeNull());
    forMember.mockReturnValue(new Promise(() => undefined));
    rerender({ id: "u2" });
    expect(result.current.vm).toBeNull();
  });

  it("cancels a member's unused rings only with a reason, then shows them as they are", async () => {
    cancelUnused.mockResolvedValue({ cancelled: 9 });
    const { result } = renderHook(() => useAdminMemberRingsPresenter("u1", true));
    await waitFor(() => expect(result.current.cancelUnusedLabel).toBe("Cancel unused rings"));
    act(() => result.current.onCancelUnused());
    expect(result.current.dialog?.title).toBe("Cancel 9 unused rings?");
    expect(result.current.dialog?.canConfirm).toBe(false);
    act(() => result.current.dialog?.reason?.set("Payment reversed"));
    expect(result.current.dialog?.canConfirm).toBe(true);
    await act(async () => result.current.dialog?.confirm());
    expect(cancelUnused).toHaveBeenCalledWith("u1", "Payment reversed");
    expect(result.current.dialog).toBeNull();
    expect(result.current.notice).toBe("Cancelled 9 rings.");
    await waitFor(() => expect(forMember).toHaveBeenCalledTimes(2));
  });

  it("cancels the Silver a ring gave, and says when theirs ends now", async () => {
    cancelSilver.mockResolvedValue({ memberId: "u2", silverUntil: null });
    const { result } = renderHook(() => useAdminMemberRingsPresenter("u1", true));
    await waitFor(() => expect(result.current.vm).not.toBeNull());
    act(() => result.current.onCancelSilver("r2", "@tega (Tega)"));
    expect(result.current.dialog?.body).toContain("@tega (Tega) loses the month of Silver");
    act(() => result.current.dialog?.reason?.set("Fraud"));
    await act(async () => result.current.dialog?.confirm());
    expect(cancelSilver).toHaveBeenCalledWith("r2", "Fraud");
    expect(result.current.notice).toBe("Silver cancelled. They're on Basic now.");
  });

  it("keeps the dialog open with the API's reason when it refuses", async () => {
    cancelSilver.mockRejectedValue(new Error("The Silver from that ring was already cancelled."));
    const { result } = renderHook(() => useAdminMemberRingsPresenter("u1", true));
    await waitFor(() => expect(result.current.vm).not.toBeNull());
    act(() => result.current.onCancelSilver("r2", "@tega (Tega)"));
    act(() => result.current.dialog?.reason?.set("Fraud"));
    await act(async () => result.current.dialog?.confirm());
    expect(result.current.dialog?.error).toBe("The Silver from that ring was already cancelled.");
    await waitFor(() => expect(forMember).toHaveBeenCalledTimes(2));
  });
});
