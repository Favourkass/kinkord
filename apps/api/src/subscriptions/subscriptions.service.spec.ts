import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscriptionPayment } from "../db/schema";
import type { PushService } from "../push/push.service";
import type { StorageService } from "../storage/storage.service";
import { DEFAULT_PRICES, PAYMENT_WINDOW_MS, PROOF_GRACE_MS } from "./plans";
import {
  RECEIPT_MAX_MB,
  SubscriptionsService,
  toPaymentDto,
  type PaymentRow,
} from "./subscriptions.service";

/**
 * A stand-in for the Drizzle client: every builder call returns the chain, and
 * each `await` takes the next queued answer (an Error is thrown), so a spec
 * lists the database's replies in the order the code asks.
 */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            value instanceof Error ? reject(value) : resolve(value);
        }
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = calls.findIndex((c) => c.op === anchor && c.args[0] === table);
    return start < 0 ? undefined : calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: chain() as never, calls, after, left: () => queue.length };
}

function make(answers: unknown[]) {
  const q = queuedDb(answers);
  const storage = {
    presignUpload: vi.fn(async (key: string) => `https://upload/${key}`),
    describe: vi.fn(async () => ({ size: 200_000, contentType: "image/jpeg" })),
    remove: vi.fn(async () => undefined),
  };
  const push = { newPayment: vi.fn() };
  const service = new SubscriptionsService(
    q.db,
    storage as unknown as StorageService,
    push as unknown as PushService,
  );
  service.random = () => 0.46; // offset 46 of the two-digit 1..99
  return { ...q, service, storage, push };
}

const NOW = new Date("2026-09-24T10:42:38Z");
const ID = "11111111-1111-4111-8111-111111111111";

const settingsRow = {
  id: 1,
  bankName: "UBA",
  accountName: "Kinkord Ltd",
  accountNumber: "1028154254",
  monthlyKobo: 560_000,
  yearlyKobo: 3_360_000,
  monthlyUsdCents: 400,
  yearlyUsdCents: 2400,
  updatedBy: "a1",
  updatedAt: NOW,
};

function payment(over: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: ID,
    userId: "u1",
    plan: "silver",
    period: "yearly",
    reference: "KIN20260924114238",
    amountKobo: 3_364_700,
    usdCents: 2403,
    bankName: "UBA",
    accountName: "Kinkord Ltd",
    accountNumber: "1028154254",
    status: "pending",
    expiresAt: new Date(NOW.getTime() + PAYMENT_WINDOW_MS),
    paidReference: null,
    paidAmountKobo: null,
    senderBankName: null,
    senderAccountName: null,
    senderAccountNumber: null,
    receiptKey: null,
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: NOW,
    ...over,
  };
}

const proof = {
  reference: "KIN20260924114238",
  amountKobo: 3_364_700,
  senderBankName: "GTBank",
  senderAccountName: "John Doe",
  senderAccountNumber: "0123456789",
  receiptKey: `payments/u1/${ID}/r.jpg`,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toPaymentDto", () => {
  it("shows a pending payment past its proof deadline as expired", () => {
    const row = payment();
    const late = new Date(row.expiresAt.getTime() + PROOF_GRACE_MS + 1);
    expect(toPaymentDto(row, NOW).status).toBe("pending");
    expect(toPaymentDto(row, late).status).toBe("expired");
  });

  it("carries the proof once the member has sent it", () => {
    const row = payment({
      status: "submitted",
      paidReference: "KIN1",
      paidAmountKobo: 3_364_700,
      senderBankName: "GTBank",
      senderAccountName: "John Doe",
      senderAccountNumber: "0123456789",
      submittedAt: NOW,
    });
    expect(toPaymentDto(row, NOW).proof).toEqual({
      reference: "KIN1",
      amountKobo: 3_364_700,
      senderBankName: "GTBank",
      senderAccountName: "John Doe",
      senderAccountNumber: "0123456789",
    });
    expect(toPaymentDto(payment(), NOW).proof).toBeNull();
  });
});

describe("SubscriptionsService.status", () => {
  it("is Basic with the design's prices while no account is set", async () => {
    const { service } = make([[], [], [], []]);
    await expect(service.status("u1")).resolves.toEqual({
      plan: "basic",
      silverUntil: null,
      check: null,
      available: false,
      prices: DEFAULT_PRICES,
      open: null,
      rejected: null,
    });
  });

  it("shows Silver, and the payment still in play", async () => {
    const end = new Date("2026-11-06T12:00:00Z");
    // The helpers' queries run as Promise.all builds its list; the payments query last.
    const { service } = make([
      [settingsRow],
      [{ end }],
      [
        {
          heldAt: null,
          heldFor: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          avatarKey: "a",
          coverKey: "c",
        },
      ],
      [payment({ status: "submitted" })],
    ]);
    const status = await service.status("u1");
    expect(status).toMatchObject({ plan: "silver", silverUntil: end.toISOString() });
    expect(status.available).toBe(true);
    expect(status.open?.status).toBe("submitted");
    expect(status.check).toEqual({ shown: true, reason: null, heldFor: null, showsFrom: null });
  });

  it("says why a Silver member's check isn't showing yet", async () => {
    const end = new Date("2026-11-06T12:00:00Z");
    const created = new Date("2026-09-20T00:00:00Z");
    const fresh = make([
      [settingsRow],
      [{ end }],
      [{ heldAt: null, heldFor: null, createdAt: created, avatarKey: "a", coverKey: "c" }],
      [],
    ]);
    await expect(fresh.service.status("u1")).resolves.toMatchObject({
      check: { shown: false, reason: "new_account", showsFrom: "2026-10-20T00:00:00.000Z" },
    });
    const held = make([
      [settingsRow],
      [{ end }],
      [{ heldAt: NOW, heldFor: "name", createdAt: created, avatarKey: "a", coverKey: "c" }],
      [],
    ]);
    await expect(held.service.status("u1")).resolves.toMatchObject({
      check: { shown: false, reason: "held", heldFor: "name" },
    });
  });

  it("surfaces the last payment when it was rejected", async () => {
    const rejected = payment({ status: "rejected", reviewNote: "No such transfer" });
    const { service } = make([[settingsRow], [], [], [rejected, payment({ status: "verified" })]]);
    const status = await service.status("u1");
    expect(status.rejected?.reviewNote).toBe("No such transfer");
    expect(status.open).toBeNull();
  });
});

describe("SubscriptionsService.checkout", () => {
  it("stays closed until there's an account to pay into", async () => {
    const { service } = make([[]]);
    await expect(service.checkout("u1", "yearly")).rejects.toBeInstanceOf(ConflictException);
  });

  it("won't start another payment while one is being checked", async () => {
    const { service } = make([[settingsRow], [payment({ status: "submitted" })]]);
    await expect(service.checkout("u1", "monthly")).rejects.toThrow(/still checking/);
  });

  it("picks up the running checkout for the same plan", async () => {
    const running = payment();
    const { service, left } = make([[settingsRow], [running]]);
    await expect(service.checkout("u1", "yearly")).resolves.toMatchObject({
      id: ID,
      amountKobo: 3_364_700,
    });
    expect(left()).toBe(0);
  });

  it("makes an amount nobody else is paying, with a reference and a one-hour window", async () => {
    const { service, after } = make([
      [settingsRow],
      [], // nothing open for this member
      undefined, // abandoned checkouts let go
      [{ amountKobo: 3_360_000 + 4_700 }], // ₦47 is taken
      [payment()],
    ]);
    await service.checkout("u1", "yearly");
    const values = after("insert", subscriptionPayment, "values") as Record<string, unknown>;
    expect(values).toMatchObject({
      userId: "u1",
      plan: "silver",
      period: "yearly",
      reference: "KIN20260924114238",
      // 0.46 of the 98 free offsets is the 46th: ₦46, since ₦47 is taken.
      amountKobo: 3_360_000 + 4_600,
      usdCents: 2403,
      bankName: "UBA",
      accountName: "Kinkord Ltd",
      accountNumber: "1028154254",
      expiresAt: new Date(NOW.getTime() + PAYMENT_WINDOW_MS),
    });
  });

  it("lets go of the member's other checkout when they switch plans", async () => {
    const { service, calls } = make([
      [settingsRow],
      [payment({ period: "monthly", amountKobo: 564_700 })],
      undefined, // their monthly checkout expired
      undefined, // abandoned checkouts let go
      [],
      [payment()],
    ]);
    await service.checkout("u1", "yearly");
    expect(calls.filter((c) => c.op === "update")).toHaveLength(2);
  });

  it("tries again when another member takes the same amount or second", async () => {
    const clash = Object.assign(new Error("duplicate key"), { code: "23505" });
    const { service, after, left } = make([
      [settingsRow],
      [],
      undefined,
      [],
      clash,
      [],
      [payment({ reference: "KIN20260924114239" })],
    ]);
    await expect(service.checkout("u1", "yearly")).resolves.toMatchObject({
      reference: "KIN20260924114239",
    });
    expect(left()).toBe(0);
    expect(after("insert", subscriptionPayment, "values")).toBeDefined();
  });

  it("passes on any other database failure", async () => {
    const { service } = make([[settingsRow], [], undefined, [], new Error("connection lost")]);
    await expect(service.checkout("u1", "yearly")).rejects.toThrow("connection lost");
  });
});

describe("SubscriptionsService.payment", () => {
  it("is only the member's own", async () => {
    const { service } = make([[]]);
    await expect(service.payment("u2", ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("SubscriptionsService.presignReceipt", () => {
  it("hands out a slot under the member's and payment's own prefix", async () => {
    const { service, storage } = make([[payment()]]);
    const slot = await service.presignReceipt("u1", ID, "image/png", 1000);
    expect(slot.key).toMatch(new RegExp(`^payments/u1/${ID}/[0-9a-f-]+\\.png$`));
    expect(slot.maxSizeMb).toBe(RECEIPT_MAX_MB);
    expect(storage.presignUpload).toHaveBeenCalledWith(slot.key, "image/png", 1000);
  });

  it("refuses files that aren't photos, or are too big", async () => {
    await expect(
      make([[payment()]]).service.presignReceipt("u1", ID, "application/pdf"),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      make([[payment()]]).service.presignReceipt("u1", ID, "image/jpeg", 11 * 1024 * 1024),
    ).rejects.toThrow(/too large/);
  });

  it("refuses a payment that no longer takes proof", async () => {
    const late = payment({ expiresAt: new Date(NOW.getTime() - PROOF_GRACE_MS - 1) });
    await expect(
      make([[late]]).service.presignReceipt("u1", ID, "image/jpeg"),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      make([[payment({ status: "rejected" })]]).service.presignReceipt("u1", ID, "image/jpeg"),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("SubscriptionsService.submit", () => {
  it("records the proof and tells the admins", async () => {
    const sent = payment({
      status: "submitted",
      paidReference: proof.reference,
      paidAmountKobo: proof.amountKobo,
      senderBankName: proof.senderBankName,
      senderAccountName: proof.senderAccountName,
      senderAccountNumber: proof.senderAccountNumber,
      receiptKey: proof.receiptKey,
      submittedAt: NOW,
    });
    const { service, after, push } = make([[payment()], [sent]]);
    await expect(service.submit("u1", ID, proof)).resolves.toMatchObject({
      status: "submitted",
      proof: { senderAccountName: "John Doe" },
    });
    expect(after("update", subscriptionPayment, "set")).toMatchObject({
      status: "submitted",
      senderAccountName: "John Doe",
      receiptKey: proof.receiptKey,
      submittedAt: NOW,
    });
    expect(push.newPayment).toHaveBeenCalledOnce();
  });

  it("still takes proof after the countdown, within the grace", async () => {
    const slow = payment({ expiresAt: new Date(NOW.getTime() - 60_000) });
    const { service } = make([[slow], [payment({ status: "submitted", submittedAt: NOW })]]);
    await expect(service.submit("u1", ID, proof)).resolves.toMatchObject({
      status: "submitted",
    });
  });

  it("refuses a receipt from someone else's upload", async () => {
    const { service, storage, push } = make([[payment()]]);
    await expect(
      service.submit("u1", ID, { ...proof, receiptKey: `payments/u2/${ID}/r.jpg` }),
    ).rejects.toThrow(/unknown upload/);
    expect(storage.describe).not.toHaveBeenCalled();
    expect(push.newPayment).not.toHaveBeenCalled();
  });

  it("refuses a receipt that never arrived, or isn't a photo", async () => {
    const missing = make([[payment()]]);
    missing.storage.describe.mockResolvedValueOnce(null as never);
    await expect(missing.service.submit("u1", ID, proof)).rejects.toThrow(/didn't arrive/);

    const pdf = make([[payment()]]);
    pdf.storage.describe.mockResolvedValueOnce({ size: 100, contentType: "application/pdf" });
    await expect(pdf.service.submit("u1", ID, proof)).rejects.toBeInstanceOf(BadRequestException);
    expect(pdf.storage.remove).toHaveBeenCalledWith(proof.receiptKey);
  });

  it("refuses a second submission", async () => {
    await expect(
      make([[payment({ status: "submitted" })]]).service.submit("u1", ID, proof),
    ).rejects.toThrow(/already been sent/);
    // Two taps at once: the second finds the row no longer pending.
    const { service, push } = make([[payment()], []]);
    await expect(service.submit("u1", ID, proof)).rejects.toThrow(/already been sent/);
    expect(push.newPayment).not.toHaveBeenCalled();
  });
});

describe("SubscriptionsService.silverUntil", () => {
  it("is when Silver runs out, or null on Basic", async () => {
    const end = new Date("2026-11-06T12:00:00Z");
    await expect(make([[{ end }]]).service.silverUntil("u1")).resolves.toEqual(end);
    await expect(make([[]]).service.silverUntil("u1")).resolves.toBeNull();
  });
});
