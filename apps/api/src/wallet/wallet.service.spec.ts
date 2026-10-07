import { describe, it, expect, vi } from "vitest";
import { WalletService, walletOperationDto } from "./wallet.service";
import type { Db } from "../db/db.module";
import type { StorageService } from "../storage/storage.service";
const rates = {
  coin: { buy: 1000, redeem: 800 },
  star: { buy: 10000, redeem: 8000 },
  crown: { buy: 100000, redeem: 80000 },
};
const row = {
  id: "op",
  userId: "user",
  kind: "purchase" as const,
  currency: "coin" as const,
  quantity: 100,
  amountKobo: 100000,
  status: "pending" as const,
  reference: "KRD-TEST",
  requestKey: "key",
  bankName: "Test",
  accountName: "Test",
  accountNumber: "1234567890",
  receiptKey: null,
  senderReference: null,
  senderAccountName: null,
  reviewNote: null,
  reviewedBy: null,
  settlementReference: null,
  paidBy: null,
  createdAt: new Date("2026-10-07T10:00:00Z"),
  updatedAt: new Date("2026-10-07T10:00:00Z"),
};
function fixture(results: unknown[][], updates: unknown[][] = []) {
  const chain = (rows: unknown[]) => {
    const obj: Record<string, unknown> = {
      then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
    };
    for (const name of [
      "from",
      "where",
      "orderBy",
      "limit",
      "for",
      "set",
      "values",
      "onConflictDoUpdate",
      "returning",
    ])
      obj[name] = () => obj;
    return obj;
  };
  const db = {
    select: vi.fn(() => chain(results.shift() ?? [])),
    update: vi.fn(() => chain(updates.shift() ?? [])),
    insert: vi.fn(() => chain([])),
    execute: vi.fn(async () => []),
    transaction: vi.fn(),
  };
  db.transaction.mockImplementation(async (callback) => callback(db));
  const storage = {
    describe: vi.fn(async () => ({ size: 100, contentType: "image/jpeg" })),
    presignUpload: vi.fn(async () => "https://example.test/upload"),
    presignDownload: vi.fn(async () => "https://example.test/receipt"),
  };
  return {
    db,
    storage,
    service: new WalletService(db as unknown as Db, storage as unknown as StorageService),
  };
}
describe("WalletService", () => {
  it("does not reveal a transaction that was not returned by the ownership-scoped query", async () => {
    const { service } = fixture([[]]);
    await expect(service.operation("other", "op")).rejects.toThrow(/not found/);
  });
  it("does not create a withdrawal or ledger hold when the atomic balance reservation fails", async () => {
    const { service, db } = fixture(
      [
        [],
        [{ rates, enabled: 1, minimumKobo: 80000 }],
        [
          {
            id: "bank",
            userId: "user",
            bankName: "Test",
            accountName: "Test",
            accountNumber: "1234567890",
          },
        ],
      ],
      [[]],
    );
    await expect(
      service.create("user", "withdrawal", {
        currency: "coin",
        quantity: 100,
        bankId: "bank",
        requestKey: "key",
      }),
    ).rejects.toThrow(/Insufficient/);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("returns an idempotent request without touching balances or duplicating a ledger entry", async () => {
    const { service, db } = fixture([[row]]);
    expect(
      (
        await service.create("user", "purchase", {
          currency: "coin",
          quantity: 100,
          requestKey: "key",
        })
      ).id,
    ).toBe("op");
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("refuses receipts from another member/payment before querying storage", async () => {
    const { service, storage } = fixture([[row]]);
    await expect(
      service.submit("user", "op", {
        receiptKey: "wallet-receipts/other/op/x.jpg",
        senderReference: "x",
        senderAccountName: "Test",
      }),
    ).rejects.toThrow(/this payment/);
    expect(storage.describe).not.toHaveBeenCalled();
  });
  it("will not upload proof to a payment already verified", async () => {
    const { service, storage } = fixture([[{ ...row, status: "verified" }]]);
    await expect(service.receiptUpload("user", "op", "image/jpeg", 100)).rejects.toThrow(/proof/);
    expect(storage.presignUpload).not.toHaveBeenCalled();
  });
  it("rejects a repeated verification inside the transaction before crediting", async () => {
    const decided = { ...row, status: "verified" };
    const { service, db } = fixture([[decided], [decided]]);
    await expect(
      service.decide("admin", "op", { action: "verify", bankReference: "REF" }),
    ).rejects.toThrow(/already/);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("requires another admin to review the beneficiary's own transaction", async () => {
    const { service, db } = fixture([[row]]);
    await expect(
      service.decide("user", "op", { action: "reject", note: "Reject" }),
    ).rejects.toThrow(/Another admin/);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("rejects an idempotency key reused with another quantity", async () => {
    const { service, db } = fixture([[row]]);
    await expect(
      service.create("user", "purchase", { currency: "coin", quantity: 500, requestKey: "key" }),
    ).rejects.toThrow(/Request key/);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("formats timestamps for member history", () => {
    expect(walletOperationDto(row).createdAt).toBe("2026-10-07T10:00:00.000Z");
  });
});
