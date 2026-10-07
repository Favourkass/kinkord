// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentPM } from "@/domain/subscription";
import { proofProblem, usePaymentProofPresenter } from "./usePaymentProofPresenter";

const getPayment = vi.fn();
const uploadReceipt = vi.fn();
const submit = vi.fn();
vi.mock("@/services/subscription.service", () => ({
  subscriptionService: {
    payment: (...a: unknown[]) => getPayment(...a),
    uploadReceipt: (...a: unknown[]) => uploadReceipt(...a),
    submit: (...a: unknown[]) => submit(...a),
  },
}));

const payment = (over: Partial<PaymentPM> = {}): PaymentPM => ({
  id: "p1",
  plan: "silver",
  period: "yearly",
  status: "pending",
  reference: "KIN20261006123000",
  amountKobo: 3_364_700,
  usdCents: 2403,
  bank: { name: "UBA", accountName: "Kinkord Ltd", accountNumber: "1028154254" },
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  proofUntil: new Date(Date.now() + 90_000_000).toISOString(),
  submittedAt: null,
  reviewedAt: null,
  reviewNote: null,
  proof: null,
  createdAt: new Date().toISOString(),
  ...over,
});

const receipt = () => new File(["png"], "receipt.png", { type: "image/png" });

beforeEach(() => {
  getPayment.mockReset().mockResolvedValue(payment());
  uploadReceipt.mockReset().mockResolvedValue("payments/u1/p1/r.png");
  submit.mockReset().mockResolvedValue(payment({ status: "submitted" }));
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("proofProblem", () => {
  const ok = {
    reference: "KIN1",
    amount: "33,647",
    bank: "GTBank",
    name: "John Doe",
    number: "0123456789",
    receipt: { previewUrl: "blob:x", key: "k" },
  };

  it("lets complete proof through and names the first thing missing", () => {
    expect(proofProblem(ok)).toBeNull();
    expect(proofProblem({ ...ok, receipt: null })).toBe("Upload your receipt.");
    expect(proofProblem({ ...ok, receipt: { previewUrl: "x", key: null } })).toBe(
      "Wait for your receipt to finish uploading.",
    );
    expect(proofProblem({ ...ok, amount: "abc" })).toBe("Enter the amount you paid.");
    expect(proofProblem({ ...ok, bank: " " })).toBe("Enter the bank you paid from.");
    expect(proofProblem({ ...ok, name: "J" })).toBe("Enter the name on the account.");
    expect(proofProblem({ ...ok, number: "012345678" })).toBe("Account numbers are 10 digits.");
  });
});

describe("usePaymentProofPresenter", () => {
  it("starts from the reference and amount the member was given", async () => {
    const { result } = renderHook(() => usePaymentProofPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("form"));
    expect(result.current.reference).toBe("KIN20261006123000");
    expect(result.current.amount).toBe("33,647");
  });

  it("previews the receipt at once and uploads it", async () => {
    const { result } = renderHook(() => usePaymentProofPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("form"));
    act(() => result.current.pickReceipt(receipt()));
    expect(result.current.receipt).toEqual({ previewUrl: "blob:preview", uploading: true });
    await waitFor(() => expect(result.current.receipt?.uploading).toBe(false));
    expect(uploadReceipt).toHaveBeenCalledWith("p1", expect.any(File));
    act(() => result.current.removeReceipt());
    expect(result.current.receipt).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("ignores an upload that finishes after the receipt was removed", async () => {
    let finish!: (key: string) => void;
    uploadReceipt.mockImplementation(() => new Promise((r) => (finish = r)));
    const { result } = renderHook(() => usePaymentProofPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("form"));
    act(() => result.current.pickReceipt(receipt()));
    act(() => result.current.removeReceipt());
    await act(async () => finish("late-key"));
    expect(result.current.receipt).toBeNull();
  });

  it("keeps account numbers to ten digits", async () => {
    const { result } = renderHook(() => usePaymentProofPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("form"));
    act(() => result.current.setNumber("0123-456-789-99"));
    expect(result.current.number).toBe("0123456789");
    act(() => result.current.setAmount("₦33,647.50"));
    expect(result.current.amount).toBe("33,647.50");
  });

  it("sends the proof, then shows it's being checked", async () => {
    const { result } = renderHook(() => usePaymentProofPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("form"));
    act(() => result.current.pickReceipt(receipt()));
    await waitFor(() => expect(result.current.receipt?.uploading).toBe(false));
    act(() => {
      result.current.setBank(" GTBank ");
      result.current.setName("John Doe");
      result.current.setNumber("0123456789");
    });
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.view).toBe("submitted"));
    expect(submit).toHaveBeenCalledWith("p1", {
      reference: "KIN20261006123000",
      amountKobo: 3_364_700,
      senderBankName: "GTBank",
      senderAccountName: "John Doe",
      senderAccountNumber: "0123456789",
      receiptKey: "payments/u1/p1/r.png",
    });
    expect(result.current.notice?.title).toBe("Payment sent for verification");
  });

  it("says what's missing instead of sending", async () => {
    const { result } = renderHook(() => usePaymentProofPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("form"));
    act(() => result.current.submit());
    expect(result.current.error).toBe("Upload your receipt.");
    expect(submit).not.toHaveBeenCalled();
  });

  it("shows where a payment stands when it no longer takes proof", async () => {
    getPayment.mockResolvedValue(payment({ status: "verified" }));
    const { result } = renderHook(() => usePaymentProofPresenter("p1"));
    await waitFor(() => expect(result.current.view).toBe("verified"));
    expect(result.current.notice?.tone).toBe("success");
  });
});
