// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminPaymentPM } from "@/domain/subscription";
import { useAdminPaymentsPresenter } from "./useAdminPaymentsPresenter";

const access = vi.fn();
vi.mock("@/services/moderation.service", () => ({
  moderationService: { access: () => access() },
}));
const list = vi.fn();
const verify = vi.fn();
const reject = vi.fn();
vi.mock("@/services/subscription.service", () => ({
  paymentsAdminService: {
    list: (...a: unknown[]) => list(...a),
    verify: (...a: unknown[]) => verify(...a),
    reject: (...a: unknown[]) => reject(...a),
  },
}));

const row = (id: string, over: Partial<AdminPaymentPM> = {}): AdminPaymentPM => ({
  id,
  plan: "silver",
  period: "monthly",
  status: "submitted",
  reference: `KIN-${id}`,
  amountKobo: 564_700,
  usdCents: 403,
  bank: { name: "UBA", accountName: "Kinkord Ltd", accountNumber: "1028154254" },
  expiresAt: "2026-10-06T13:00:00Z",
  proofUntil: "2026-10-07T13:00:00Z",
  submittedAt: "2026-10-06T12:10:00Z",
  reviewedAt: null,
  reviewNote: null,
  proof: {
    reference: `KIN-${id}`,
    amountKobo: 564_700,
    senderBankName: "GTBank",
    senderAccountName: `Sender ${id}`,
    senderAccountNumber: "0123456789",
  },
  createdAt: "2026-10-06T12:00:00Z",
  member: { userId: "u1", username: "ada", displayName: "Ada" },
  receipt: { url: "https://media/r.png" },
  ...over,
});

beforeEach(() => {
  access.mockReset().mockResolvedValue({ isAdmin: true });
  list.mockReset().mockResolvedValue([row("p1"), row("p2")]);
  verify.mockReset().mockResolvedValue({ id: "p1", silverUntil: "2026-11-06T12:00:00Z" });
  reject.mockReset().mockResolvedValue({ id: "p2" });
});
afterEach(cleanup);

describe("useAdminPaymentsPresenter", () => {
  it("opens on the proofs to verify, each under the sender's name", async () => {
    const { result } = renderHook(() => useAdminPaymentsPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(list).toHaveBeenCalledWith("submitted", "");
    expect(result.current.rows[0]).toMatchObject({
      sender: "Sender p1",
      memberHref: "/moderation/members/u1",
    });
    expect(result.current.statuses.find((s) => s.active)?.value).toBe("submitted");
  });

  it("asks for nothing when the member isn't an admin", async () => {
    access.mockResolvedValue({ isAdmin: false });
    const { result } = renderHook(() => useAdminPaymentsPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(list).not.toHaveBeenCalled();
  });

  it("searches by name once the admin stops typing", async () => {
    const { result } = renderHook(() => useAdminPaymentsPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    list.mockResolvedValueOnce([row("p2")]);
    act(() => result.current.setQuery("Sender p2"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith("submitted", "Sender p2"));
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(["p2"]));
  });

  it("verifies after confirming, and says until when", async () => {
    const { result } = renderHook(() => useAdminPaymentsPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.askVerify("p1"));
    expect(result.current.dialog).toMatchObject({ title: "Verify this payment?", reason: null });
    act(() => result.current.dialog?.confirm());
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(["p2"]));
    expect(verify).toHaveBeenCalledWith("p1");
    expect(result.current.notice).toBe("Verified. Silver runs until 6 Nov 2026.");
    expect(result.current.dialog).toBeNull();
  });

  it("needs a reason to reject, and sends it", async () => {
    const { result } = renderHook(() => useAdminPaymentsPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.askReject("p2"));
    expect(result.current.dialog?.canConfirm).toBe(false);
    act(() => result.current.dialog?.reason?.set("No transfer for this amount"));
    expect(result.current.dialog?.canConfirm).toBe(true);
    act(() => result.current.dialog?.confirm());
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(["p1"]));
    expect(reject).toHaveBeenCalledWith("p2", "No transfer for this amount");
  });

  it("keeps the dialog open with the error when a decision fails", async () => {
    verify.mockRejectedValue(new Error("This payment is already verified."));
    const { result } = renderHook(() => useAdminPaymentsPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.askVerify("p1"));
    act(() => result.current.dialog?.confirm());
    await waitFor(() =>
      expect(result.current.dialog?.error).toBe("This payment is already verified."),
    );
    expect(result.current.rows).toHaveLength(2);
  });
});
