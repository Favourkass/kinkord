// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { MemberRingsPM } from "@/domain/kinkRings";
import { useAdminMemberRingsPresenter } from "./useAdminMemberRingsPresenter";

const forMember = vi.fn();
vi.mock("@/services/kinkRings.service", () => ({
  kinkRingsAdminApi: { forMember: (...a: unknown[]) => forMember(...a) },
}));

const rings: MemberRingsPM = {
  counts: { total: 12, unused: 9, given: 2, expired: 1, received: 0 },
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
        },
      ],
    },
  ],
  received: [],
};

describe("useAdminMemberRingsPresenter", () => {
  beforeEach(() => {
    forMember.mockReset().mockResolvedValue(rings);
  });

  it("shows a member's rings, each linking to whoever received it", async () => {
    const { result } = renderHook(() => useAdminMemberRingsPresenter("u1", true));
    expect(result.current.loading).toBe("Loading Kink Rings…");
    await waitFor(() => expect(result.current.vm).not.toBeNull());
    expect(forMember).toHaveBeenCalledWith("u1");
    expect(result.current.vm?.summary).toBe(
      "12 rings · 9 unused · 2 given · 1 expired · 0 received",
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
});
