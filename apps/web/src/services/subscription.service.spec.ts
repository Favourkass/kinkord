import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const upload = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: (...a: unknown[]) => put(...a),
  },
  uploadToPresignedUrl: (...a: unknown[]) => upload(...a),
}));
const compress = vi.fn(async (f: File) => f);
vi.mock("@/util/image", () => ({
  IMAGE_UPLOAD_PRESETS: { receipt: { maxDim: 2000 } },
  compressImage: (...a: unknown[]) => compress(...(a as [File])),
}));

import { paymentsAdminService, subscriptionService } from "./subscription.service";

beforeEach(() => {
  get.mockReset().mockResolvedValue({});
  post.mockReset().mockResolvedValue({});
  put.mockReset().mockResolvedValue({});
  upload.mockReset().mockResolvedValue(undefined);
  compress.mockClear();
});

describe("subscriptionService", () => {
  it("reads the plan, starts a checkout and loads a payment", async () => {
    await subscriptionService.status();
    expect(get).toHaveBeenCalledWith("/subscription");
    await subscriptionService.checkout("yearly");
    expect(post).toHaveBeenCalledWith("/subscription/checkout", { period: "yearly" });
    await subscriptionService.payment("p 1");
    expect(get).toHaveBeenLastCalledWith("/subscription/payments/p%201");
  });

  it("shrinks the receipt, uploads it to its slot and returns the key", async () => {
    post.mockResolvedValueOnce({ key: "payments/u1/p1/r.jpg", uploadUrl: "https://s3/put" });
    const file = new File(["x".repeat(10)], "r.png", { type: "image/png" });
    await expect(subscriptionService.uploadReceipt("p1", file)).resolves.toBe(
      "payments/u1/p1/r.jpg",
    );
    expect(compress).toHaveBeenCalledWith(file, { maxDim: 2000 });
    expect(post).toHaveBeenCalledWith("/subscription/payments/p1/receipt-upload-url", {
      contentType: "image/png",
      contentLength: 10,
    });
    expect(upload).toHaveBeenCalledWith("https://s3/put", file);
  });

  it("sends the proof", async () => {
    const proof = {
      reference: "KIN1",
      amountKobo: 100,
      senderBankName: "GTBank",
      senderAccountName: "John Doe",
      senderAccountNumber: "0123456789",
      receiptKey: "k",
    };
    await subscriptionService.submit("p1", proof);
    expect(post).toHaveBeenCalledWith("/subscription/payments/p1/submit", proof);
  });
});

describe("paymentsAdminService", () => {
  it("lists payments in a state, with a search when there is one", async () => {
    await paymentsAdminService.list("submitted");
    expect(get).toHaveBeenLastCalledWith("/admin/payments?status=submitted");
    await paymentsAdminService.list("verified", "  John Doe ");
    expect(get).toHaveBeenLastCalledWith("/admin/payments?status=verified&q=John+Doe");
  });

  it("verifies, rejects with a reason, and saves the settings", async () => {
    await paymentsAdminService.verify("p1");
    expect(post).toHaveBeenCalledWith("/admin/payments/p1/verify", {});
    await paymentsAdminService.reject("p1", "No such transfer");
    expect(post).toHaveBeenLastCalledWith("/admin/payments/p1/reject", {
      reason: "No such transfer",
    });
    await paymentsAdminService.settings();
    expect(get).toHaveBeenLastCalledWith("/admin/payments/settings");
    const input = {
      bankName: "UBA",
      accountName: "Kinkord Ltd",
      accountNumber: "1028154254",
      monthlyKobo: 560_000,
      yearlyKobo: 3_360_000,
      monthlyUsdCents: 400,
      yearlyUsdCents: 2400,
    };
    await paymentsAdminService.saveSettings(input);
    expect(put).toHaveBeenCalledWith("/admin/payments/settings", input);
  });
});
