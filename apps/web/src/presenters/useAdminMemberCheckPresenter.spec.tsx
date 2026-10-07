// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberCheckPM } from "@/domain/subscription";
import { useAdminMemberCheckPresenter } from "./useAdminMemberCheckPresenter";

const forMember = vi.fn();
const approve = vi.fn();
const remove = vi.fn();
vi.mock("@/services/subscription.service", () => ({
  silverChecksAdminService: {
    forMember: (...a: unknown[]) => forMember(...a),
    approve: (...a: unknown[]) => approve(...a),
    remove: (...a: unknown[]) => remove(...a),
  },
}));

const check = (over: Partial<MemberCheckPM> = {}): MemberCheckPM => ({
  silverUntil: "2027-10-06T12:00:00Z",
  shown: false,
  reason: "held",
  heldFor: "name",
  showsFrom: null,
  ...over,
});

beforeEach(() => {
  forMember.mockReset().mockResolvedValue(check());
  approve.mockReset().mockResolvedValue({ userId: "u1" });
  remove.mockReset().mockResolvedValue({ userId: "u1" });
});
afterEach(cleanup);

describe("useAdminMemberCheckPresenter", () => {
  it("stays out of the way for a member without Silver", async () => {
    forMember.mockResolvedValue(null);
    const { result } = renderHook(() => useAdminMemberCheckPresenter("u1", true));
    await waitFor(() => expect(forMember).toHaveBeenCalledWith("u1"));
    expect(result.current.vm).toBeNull();
  });

  it("shows a held check and approves it, then reloads what the API says", async () => {
    const { result } = renderHook(() => useAdminMemberCheckPresenter("u1", true));
    await waitFor(() =>
      expect(result.current.vm).toMatchObject({
        until: "Silver until 6 Oct 2027",
        status: "Hidden until you approve their new name.",
        canApprove: true,
      }),
    );
    forMember.mockResolvedValue(check({ shown: true, reason: null, heldFor: null }));
    act(() => result.current.onApprove());
    await waitFor(() => expect(result.current.vm?.shown).toBe(true));
    expect(approve).toHaveBeenCalledWith("u1");
    expect(result.current.notice).toBe("Approved. Their check shows again.");
  });

  it("removes a check only with a reason for the log", async () => {
    forMember.mockResolvedValue(check({ shown: true, reason: null, heldFor: null }));
    const { result } = renderHook(() => useAdminMemberCheckPresenter("u1", true));
    await waitFor(() => expect(result.current.vm?.canRemove).toBe(true));
    act(() => result.current.onRemove());
    expect(result.current.dialog?.canConfirm).toBe(false);
    act(() => result.current.dialog?.reason?.set(" Impersonating a member "));
    expect(result.current.dialog?.canConfirm).toBe(true);
    act(() => result.current.dialog?.confirm());
    await waitFor(() => expect(result.current.dialog).toBeNull());
    expect(remove).toHaveBeenCalledWith("u1", "Impersonating a member");
    expect(result.current.notice).toBe(
      "Removed. Their check stays hidden until an admin approves it.",
    );
  });

  it("keeps the dialog open with the error when removing fails", async () => {
    remove.mockRejectedValue(new Error("This member isn't on Silver."));
    const { result } = renderHook(() => useAdminMemberCheckPresenter("u1", true));
    await waitFor(() => expect(result.current.vm).not.toBeNull());
    act(() => result.current.onRemove());
    act(() => result.current.dialog?.reason?.set("Impersonation"));
    act(() => result.current.dialog?.confirm());
    await waitFor(() => expect(result.current.dialog?.error).toBe("This member isn't on Silver."));
  });
});
