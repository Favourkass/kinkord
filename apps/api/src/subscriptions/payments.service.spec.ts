import { ConflictException, NotFoundException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  memberSubscription,
  moderationLog,
  paymentSettings,
  subscriptionPayment,
} from "../db/schema";
import type { PushService } from "../push/push.service";
import type { StorageService } from "../storage/storage.service";
import { PAYMENT_WINDOW_MS } from "./plans";
import { PaymentsService } from "./payments.service";
import type { PaymentRow } from "./subscriptions.service";

/**
 * Each `await` takes the next queued answer; `transaction(fn)` runs `fn` on the
 * same stub, so a transaction's queries queue in line with the rest.
 */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        if (prop === "transaction") return (fn: (tx: unknown) => unknown) => fn(db);
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  const db = chain();
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = calls.findIndex((c) => c.op === anchor && c.args[0] === table);
    return start < 0 ? undefined : calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: db as never, calls, after, left: () => queue.length };
}

function make(answers: unknown[]) {
  const q = queuedDb(answers);
  const storage = { presignDownload: vi.fn(async (key: string) => `https://media/${key}`) };
  const push = { paymentVerified: vi.fn(), paymentRejected: vi.fn() };
  const service = new PaymentsService(
    q.db,
    storage as unknown as StorageService,
    push as unknown as PushService,
  );
  return { ...q, service, storage, push };
}

const NOW = new Date("2026-10-06T12:00:00Z");
const ID = "11111111-1111-4111-8111-111111111111";

function payment(over: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: ID,
    userId: "u1",
    plan: "silver",
    period: "monthly",
    reference: "KIN20261006130000",
    amountKobo: 564_700,
    usdCents: 403,
    bankName: "UBA",
    accountName: "Kinkord Ltd",
    accountNumber: "1028154254",
    status: "submitted",
    expiresAt: new Date(NOW.getTime() + PAYMENT_WINDOW_MS),
    paidReference: "KIN20261006130000",
    paidAmountKobo: 564_700,
    senderBankName: "GTBank",
    senderAccountName: "John Doe",
    senderAccountNumber: "0123456789",
    receiptKey: `payments/u1/${ID}/r.jpg`,
    submittedAt: NOW,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: NOW,
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PaymentsService.list", () => {
  it("shows each proof with its member and a link to the receipt", async () => {
    const { service, storage } = make([
      undefined, // abandoned checkouts let go first
      [{ payment: payment(), userId: "u1", username: "ada", name: "Ada", displayName: null }],
    ]);
    const [row] = await service.list("submitted");
    expect(row).toMatchObject({
      id: ID,
      status: "submitted",
      member: { userId: "u1", username: "ada", displayName: "ada" },
      proof: { senderAccountName: "John Doe" },
      receipt: { url: `https://media/payments/u1/${ID}/r.jpg` },
    });
    expect(storage.presignDownload).toHaveBeenCalledWith(`payments/u1/${ID}/r.jpg`);
  });

  it("keeps a payment whose account is gone", async () => {
    const { service } = make([
      undefined,
      [
        {
          payment: payment({ receiptKey: null, status: "pending" }),
          userId: null,
          username: null,
          name: null,
          displayName: null,
        },
      ],
    ]);
    const [row] = await service.list("pending");
    expect(row.member).toBeNull();
    expect(row.receipt).toBeNull();
  });

  it("finds a payment by the sender's name, a reference, a number or the member", async () => {
    const { service, after } = make([undefined, []]);
    await service.list("submitted", "john_");
    const where = after("from", subscriptionPayment, "where") as SQL;
    const { sql, params } = new PgDialect().sqlToQuery(where);
    expect(sql).toContain('"subscription_payment"."sender_account_name" ilike');
    expect(sql).toContain('"subscription_payment"."reference" ilike');
    expect(sql).toContain('"subscription_payment"."sender_account_number" ilike');
    expect(sql).toContain('"user"."username" ilike');
    // The search's own _ is literal, not a wildcard.
    expect(params).toContain("%john\\_%");
  });
});

describe("PaymentsService.verify", () => {
  it("turns Silver on for a month from now", async () => {
    const { service, after, push, left } = make([
      [payment()],
      [{ id: "u1" }],
      [], // no Silver yet
      undefined,
      undefined,
    ]);
    await expect(service.verify("a1", ID)).resolves.toEqual({
      id: ID,
      silverUntil: "2026-11-06T12:00:00.000Z",
    });
    expect(after("update", subscriptionPayment, "set")).toMatchObject({
      status: "verified",
      reviewedBy: "a1",
      reviewedAt: NOW,
    });
    expect(after("insert", memberSubscription, "values")).toEqual({
      userId: "u1",
      plan: "silver",
      currentPeriodEnd: new Date("2026-11-06T12:00:00Z"),
    });
    expect(after("insert", moderationLog, "values")).toEqual({
      actorId: "a1",
      action: "payment_verified",
      subjectUserId: "u1",
      detail: ID,
    });
    expect(push.paymentVerified).toHaveBeenCalledWith("u1", ID);
    expect(left()).toBe(0);
  });

  it("runs a renewal on from the end of the current period", async () => {
    const end = new Date("2026-10-20T08:00:00Z");
    const { service } = make([
      [payment({ period: "yearly" })],
      [{ id: "u1" }],
      [{ end }],
      undefined,
      undefined,
    ]);
    await expect(service.verify("a1", ID)).resolves.toMatchObject({
      silverUntil: "2027-10-20T08:00:00.000Z",
    });
  });

  it("only counts a payment once, however many admins press it", async () => {
    const { service, push } = make([[], [{ status: "verified" }]]);
    await expect(service.verify("a2", ID)).rejects.toThrow("This payment is already verified.");
    expect(push.paymentVerified).not.toHaveBeenCalled();
  });

  it("is a 404 for a payment that doesn't exist", async () => {
    const { service } = make([[], []]);
    await expect(service.verify("a1", ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("stops when the member's account is gone", async () => {
    const { service, push } = make([[payment()], []]);
    await expect(service.verify("a1", ID)).rejects.toThrow(/no longer exists/);
    expect(push.paymentVerified).not.toHaveBeenCalled();
  });
});

describe("PaymentsService.reject", () => {
  it("records why, logs it and tells the member", async () => {
    const { service, after, push } = make([[{ userId: "u1" }], undefined]);
    await expect(service.reject("a1", ID, "No transfer for this amount")).resolves.toEqual({
      id: ID,
    });
    expect(after("update", subscriptionPayment, "set")).toMatchObject({
      status: "rejected",
      reviewNote: "No transfer for this amount",
      reviewedBy: "a1",
    });
    expect(after("insert", moderationLog, "values")).toMatchObject({
      action: "payment_rejected",
      subjectUserId: "u1",
    });
    expect(push.paymentRejected).toHaveBeenCalledWith("u1", ID);
  });

  it("won't reject a payment that's been verified", async () => {
    const { service, push } = make([[], [{ status: "verified" }]]);
    await expect(service.reject("a1", ID, "Wrong amount")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(push.paymentRejected).not.toHaveBeenCalled();
  });
});

describe("PaymentsService.settings", () => {
  it("has no account until the founders add one", async () => {
    const { service } = make([[]]);
    await expect(service.settings(true)).resolves.toMatchObject({
      bank: null,
      canEdit: true,
      updatedAt: null,
    });
  });

  it("saves the account and prices, and logs the change", async () => {
    const input = {
      bankName: "UBA",
      accountName: "Kinkord Ltd",
      accountNumber: "1028154254",
      monthlyKobo: 560_000,
      yearlyKobo: 3_360_000,
      monthlyUsdCents: 400,
      yearlyUsdCents: 2400,
    };
    const saved = { id: 1, ...input, updatedBy: "a1", updatedAt: NOW };
    const { service, after } = make([undefined, undefined, [saved]]);
    await expect(service.updateSettings("a1", input)).resolves.toMatchObject({
      bank: { name: "UBA", accountName: "Kinkord Ltd", accountNumber: "1028154254" },
      prices: { monthly: { kobo: 560_000, usdCents: 400 } },
      canEdit: true,
    });
    expect(after("insert", paymentSettings, "values")).toMatchObject({ id: 1, ...input });
    expect(after("insert", moderationLog, "values")).toMatchObject({
      actorId: "a1",
      action: "payment_settings_updated",
      detail: "UBA 1028154254 (Kinkord Ltd)",
    });
  });
});
