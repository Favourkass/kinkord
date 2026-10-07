import { describe, expect, it } from "vitest";
import {
  bankBadge,
  countdown,
  naira,
  nairaDigits,
  parseNaira,
  planDate,
  savePercent,
  takesProof,
  toAdminPaymentVM,
  usd,
  yearlyListPrice,
  type AdminPaymentPM,
  type PaymentPM,
} from "./subscription";

const prices = {
  monthly: { kobo: 560_000, usdCents: 400 },
  yearly: { kobo: 3_360_000, usdCents: 2400 },
};

const payment = (over: Partial<PaymentPM> = {}): PaymentPM => ({
  id: "p1",
  plan: "silver",
  period: "yearly",
  status: "submitted",
  reference: "KIN20260924114238",
  amountKobo: 3_364_700,
  usdCents: 2403,
  bank: { name: "UBA", accountName: "Kinkord Ltd", accountNumber: "1028154254" },
  expiresAt: "2026-09-24T11:42:38Z",
  proofUntil: "2026-09-25T11:42:38Z",
  submittedAt: "2026-09-24T11:00:00Z",
  reviewedAt: null,
  reviewNote: null,
  proof: {
    reference: "KIN20260924114238",
    amountKobo: 3_364_700,
    senderBankName: "GTBank",
    senderAccountName: "John Doe",
    senderAccountNumber: "0123456789",
  },
  createdAt: "2026-09-24T10:42:38Z",
  ...over,
});

const admin = (over: Partial<AdminPaymentPM> = {}): AdminPaymentPM => ({
  ...payment(),
  member: { userId: "u1", username: "ada", displayName: "Ada" },
  receipt: { url: "https://media/r.jpg" },
  ...over,
});

const labels = {
  noProof: "No proof sent yet",
  deletedAccount: "A deleted account",
  periods: { monthly: "Monthly", yearly: "Yearly" },
  plan: "Silver",
};

describe("money", () => {
  it("shows naira with kobo only when there are some", () => {
    expect(naira(3_364_700)).toBe("₦33,647");
    expect(naira(3_364_750)).toBe("₦33,647.50");
    expect(nairaDigits(560_000)).toBe("5,600");
  });

  it("shows dollars with cents only when there are some", () => {
    expect(usd(2400)).toBe("$24");
    expect(usd(2403)).toBe("$24.03");
  });

  it("reads an amount the way members type it", () => {
    expect(parseNaira("33,647")).toBe(3_364_700);
    expect(parseNaira(" ₦33647.5 ")).toBe(3_364_750);
    expect(parseNaira("33,647.505")).toBeNull();
    expect(parseNaira("abc")).toBeNull();
    expect(parseNaira("0")).toBeNull();
  });

  it("works out the yearly saving against twelve months", () => {
    expect(savePercent(prices)).toBe(50);
    expect(yearlyListPrice(prices)).toBe(4800);
    expect(savePercent({ ...prices, yearly: { kobo: 1, usdCents: 6000 } })).toBe(0);
  });
});

describe("countdown", () => {
  it("counts hours, minutes and seconds, and stops at zero", () => {
    expect(countdown(60 * 60 * 1000)).toBe("01:00:00");
    expect(countdown(59 * 60 * 1000 + 1500)).toBe("00:59:02");
    expect(countdown(-5000)).toBe("00:00:00");
  });
});

describe("bankBadge", () => {
  it("uses short names whole and initials for long ones", () => {
    expect(bankBadge("UBA")).toEqual({ text: "UBA", colour: "#D71920" });
    expect(bankBadge("Access Bank").text).toBe("AB");
    expect(bankBadge("First Bank of Nigeria Plc").text).toBe("FBN");
    expect(bankBadge("Access Bank").colour).toBe("#3F3F46");
  });
});

describe("planDate", () => {
  it("reads in Lagos time", () => {
    expect(planDate("2027-10-06T23:30:00Z")).toBe("7 Oct 2027");
  });
});

describe("takesProof", () => {
  it("is true for a pending payment until its proof deadline", () => {
    const pending = payment({ status: "pending" });
    expect(takesProof(pending, new Date("2026-09-25T11:00:00Z"))).toBe(true);
    expect(takesProof(pending, new Date("2026-09-25T12:00:00Z"))).toBe(false);
    expect(takesProof(payment(), new Date("2026-09-24T11:00:00Z"))).toBe(false);
  });
});

describe("toAdminPaymentVM", () => {
  const now = new Date("2026-09-24T11:05:00Z");

  it("heads a payment with the name on the sending account", () => {
    expect(toAdminPaymentVM(admin(), (id) => `/m/${id}`, labels, now)).toMatchObject({
      sender: "John Doe",
      senderBank: "GTBank",
      senderNumber: "0123456789",
      member: "Ada · @ada",
      memberHref: "/m/u1",
      plan: "Silver · Yearly",
      expected: "₦33,647",
      paid: "₦33,647",
      amountMatches: true,
      paidReference: null,
      when: "5 minutes ago",
      receiptUrl: "https://media/r.jpg",
      canVerify: true,
      canReject: true,
    });
  });

  it("flags an amount or reference that isn't the one given", () => {
    const vm = toAdminPaymentVM(
      admin({
        proof: { ...payment().proof!, amountKobo: 3_360_000, reference: "TRF-889" },
      }),
      (id) => id,
      labels,
      now,
    );
    expect(vm.amountMatches).toBe(false);
    expect(vm.paid).toBe("₦33,600");
    expect(vm.paidReference).toBe("TRF-889");
  });

  it("keeps a payment with no proof or no account", () => {
    const vm = toAdminPaymentVM(
      admin({ status: "pending", proof: null, member: null, receipt: null }),
      (id) => id,
      labels,
      now,
    );
    expect(vm).toMatchObject({
      sender: "No proof sent yet",
      member: "A deleted account",
      memberHref: null,
      paid: null,
      receiptUrl: null,
      canReject: true,
    });
  });

  it("offers no decision on a verified payment", () => {
    const vm = toAdminPaymentVM(admin({ status: "verified" }), (id) => id, labels, now);
    expect(vm.canVerify).toBe(false);
    expect(vm.canReject).toBe(false);
  });
});
