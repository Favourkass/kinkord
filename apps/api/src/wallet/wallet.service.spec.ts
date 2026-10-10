import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
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
/** What a balance write sets a column to, as SQL. */
const setSql = (value: unknown) => new PgDialect().sqlToQuery(value as SQL);
function fixture(results: unknown[][], updates: unknown[][] = [], inserts: unknown[][] = []) {
  // Every .set(...) and .values(...), in order, so a test can read what was written.
  const sets: Record<string, unknown>[] = [];
  const values: Record<string, unknown>[] = [];
  const orders: unknown[] = [];
  const chain = (rows: unknown[]) => {
    const obj: Record<string, unknown> = {
      then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
    };
    for (const name of [
      "from",
      "innerJoin",
      "leftJoin",
      "where",
      "limit",
      "for",
      "onConflictDoUpdate",
      "returning",
    ])
      obj[name] = () => obj;
    obj.orderBy = (o: unknown) => {
      orders.push(o);
      return obj;
    };
    obj.set = (v: Record<string, unknown>) => {
      sets.push(v);
      return obj;
    };
    obj.values = (v: Record<string, unknown>) => {
      values.push(v);
      return obj;
    };
    return obj;
  };
  const db = {
    select: vi.fn(() => chain(results.shift() ?? [])),
    update: vi.fn(() => chain(updates.shift() ?? [])),
    insert: vi.fn(() => chain(inserts.shift() ?? [])),
    execute: vi.fn(async () => []),
    transaction: vi.fn(),
  };
  db.transaction.mockImplementation(async (callback) => callback(db));
  const storage = {
    describe: vi.fn(async () => ({ size: 100, contentType: "image/jpeg" })),
    presignUpload: vi.fn(async () => "https://example.test/upload"),
    presignDownload: vi.fn(async () => "https://example.test/receipt"),
  };
  const service = new WalletService(db as unknown as Db, storage as unknown as StorageService);
  vi.spyOn(service, "redemptionEligibility").mockResolvedValue({ canRedeem: true, reason: null });
  return { db, storage, service, sets, values, orders };
}
describe("WalletService", () => {
  it("uses independent USD pricing even when Silver prices and the old NGN cache differ", async () => {
    const usdRates = {
      coin: { buy: 10, redeem: 8 },
      star: { buy: 100, redeem: 80 },
      crown: { buy: 1000, redeem: 800 },
    };
    const payment = {
      bankName: "Test Bank",
      accountName: "Test",
      accountNumber: "1234567890",
      monthlyKobo: 560000,
      monthlyUsdCents: 400,
      yearlyKobo: 3360000,
      yearlyUsdCents: 2400,
    };
    const config = { rates, usdRates, exchangeRateKobo: 140000, minimumKobo: 10000000, enabled: 1 };
    const { service } = fixture([[config], [payment]]);
    expect(await service.settings()).toMatchObject({
      usdConversion: { kobo: 140000, usdCents: 100 },
      rates: { coin: { buy: 14000, redeem: 11200 } },
    });
    const purchase = fixture([[], [config], [payment], []], [], [[row]]);
    await purchase.service.create("user", "purchase", {
      currency: "coin",
      quantity: 100,
      requestKey: "new",
    });
    expect(purchase.values[0]).toMatchObject({ quantity: 100, amountKobo: 1400000 });
  });

  it("does not reveal a transaction that was not returned by the ownership-scoped query", async () => {
    const { service } = fixture([[]]);
    await expect(service.operation("other", "op")).rejects.toThrow(/not found/);
  });
  it("does not create a withdrawal or ledger hold when the atomic balance reservation fails", async () => {
    const { service, db } = fixture(
      [
        [],
        [{ rates, enabled: 1, minimumKobo: 10_000_000 }],
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
        quantity: 12500,
        bankId: "bank",
        requestKey: "key",
      }),
    ).rejects.toThrow(/received as gifts/);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("holds only coins received as gifts for a withdrawal", async () => {
    const bank = {
      id: "bank",
      userId: "user",
      bankName: "Test",
      accountName: "Test",
      accountNumber: "1234567890",
    };
    const { service, sets, values } = fixture(
      [[], [{ rates, enabled: 1, minimumKobo: 10_000_000 }], [bank]],
      [[{ userId: "user" }]],
      [[{ ...row, kind: "withdrawal" }]],
    );
    await service.create("user", "withdrawal", {
      currency: "coin",
      quantity: 12500,
      bankId: "bank",
      requestKey: "key",
    });
    expect(setSql(sets[0].earned)).toMatchObject({
      sql: '"wallet_balance"."earned"-$1',
      params: [12500],
    });
    expect(values[0]).toMatchObject({ kind: "withdrawal", bankId: "bank" });
    expect(values[1]).toMatchObject({ phase: "hold", availableDelta: -12500, earnedDelta: -12500 });
  });
  it("refuses a withdrawal sent as someone other than who is signed in", async () => {
    const { service, db } = fixture([]);
    await expect(
      service.create("user", "withdrawal", {
        currency: "coin",
        quantity: 12500,
        bankId: "bank",
        requestKey: "key",
        senderId: "someone-else",
      }),
    ).rejects.toMatchObject({ response: { code: "WRONG_ACCOUNT" } });
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it("refuses a withdrawal whose rate changed after the member reviewed it", async () => {
    const { service, db } = fixture([[], [{ rates, enabled: 1, minimumKobo: 10_000_000 }]]);
    await expect(
      service.create("user", "withdrawal", {
        currency: "coin",
        quantity: 12500,
        bankId: "bank",
        requestKey: "key",
        // Reviewed at ₦4.00 a coin; it's ₦8.00 now.
        expectedAmountKobo: 40000,
      }),
    ).rejects.toThrow(/rate has changed/);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("replays a withdrawal whose account has since been removed", async () => {
    const made = { ...row, kind: "withdrawal" as const, bankId: "bank" };
    const { service, db } = fixture([[made]]);
    const again = await service.create("user", "withdrawal", {
      currency: "coin",
      quantity: 100,
      bankId: "bank",
      requestKey: "key",
    });
    expect(again.id).toBe("op");
    // Not looked up again: the account may be gone.
    expect(db.select).toHaveBeenCalledOnce();
    expect(db.update).not.toHaveBeenCalled();
  });
  it("refuses a replay that names another account", async () => {
    const made = { ...row, kind: "withdrawal" as const, bankId: "bank" };
    const { service } = fixture([[made]]);
    await expect(
      service.create("user", "withdrawal", {
        currency: "coin",
        quantity: 100,
        bankId: "other",
        requestKey: "key",
      }),
    ).rejects.toThrow(/different bank/);
  });
  it("gives the coins back, withdrawable again, when a withdrawal is rejected", async () => {
    const pending = { ...row, kind: "withdrawal" as const, status: "pending" as const };
    const { service, sets, values } = fixture(
      [[pending], [pending]],
      [[{ ...pending, status: "rejected" }], [{ userId: "user" }]],
    );
    await service.decide("admin", "op", { action: "reject", note: "Wrong account" });
    expect(setSql(sets[1].earned)).toMatchObject({
      sql: '"wallet_balance"."earned"+$1',
      params: [100],
    });
    expect(values[0]).toMatchObject({ phase: "release", availableDelta: 100, earnedDelta: 100 });
  });
  it("lists waiting requests oldest first, and settled ones newest first", async () => {
    for (const [status, order] of [
      ["submitted", "asc"],
      ["approved", "asc"],
      ["verified", "desc"],
      ["paid", "desc"],
      ["rejected", "desc"],
      [undefined, "desc"],
    ] as const) {
      const { service, orders } = fixture([[]]);
      await service.queue("withdrawal", status);
      expect(setSql(orders[0]).sql).toBe(`"wallet_operation"."created_at" ${order}`);
    }
  });
  it("says how much of each balance can be withdrawn", async () => {
    const { service } = fixture([[{ currency: "coin", available: 50, reserved: 5, earned: 20 }]]);
    expect(await service.balances("user")).toEqual([
      { currency: "coin", available: 50, reserved: 5, withdrawable: 20 },
      { currency: "star", available: 0, reserved: 0, withdrawable: 0 },
      { currency: "crown", available: 0, reserved: 0, withdrawable: 0 },
    ]);
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

it("enforces the two-account limit on the server before inserting", async () => {
  const { service, db } = fixture([[{ id: "one" }, { id: "two" }]]);
  await expect(
    service.addBank("user", { bankName: "Kuda", accountName: "Test", accountNumber: "1234567890" }),
  ).rejects.toThrow(/up to 2/);
  expect(db.insert).not.toHaveBeenCalled();
});

describe("withdrawal membership eligibility", () => {
  it("refuses an ineligible withdrawal before reserving funds", async () => {
    const { service, db } = fixture([[]]);
    vi.mocked(service.redemptionEligibility).mockResolvedValue({
      canRedeem: false,
      reason: "Silver subscription and verification required",
    });
    await expect(
      service.create("user", "withdrawal", {
        currency: "coin",
        quantity: 100,
        requestKey: "key",
        bankId: "bank",
      }),
    ).rejects.toThrow(/Silver/);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("uses the existing Silver badge rule and denies missing, held or young accounts", async () => {
    const eligible = {
      heldAt: null,
      heldFor: null,
      createdAt: new Date("2020-01-01"),
      avatarKey: "avatar",
      coverKey: "cover",
    };
    for (const [rows, expected] of [
      [[], false],
      [[eligible], true],
      [[{ ...eligible, heldAt: new Date() }], false],
      [[{ ...eligible, createdAt: new Date() }], false],
    ] as const) {
      const { service } = fixture([[...rows]]);
      vi.mocked(service.redemptionEligibility).mockRestore();
      expect((await service.redemptionEligibility("user")).canRedeem).toBe(expected);
    }
  });
});
