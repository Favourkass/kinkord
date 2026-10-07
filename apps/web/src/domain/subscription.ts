/**
 * Silver by bank transfer: what the API returns (PMs), the money and time
 * formats the screens show, and the admin queue's rows (VMs). Routing isn't
 * known here, so the presenters pass href builders in.
 */
import { timeAgo } from "@/util/format";

export type PlanPeriod = "monthly" | "yearly";
export type PaymentStatus = "pending" | "submitted" | "verified" | "rejected" | "expired";

export interface PlanPricePM {
  kobo: number;
  usdCents: number;
}

export type PlanPricesPM = Record<PlanPeriod, PlanPricePM>;

export interface BankAccountPM {
  name: string;
  accountName: string;
  accountNumber: string;
}

/** What the member says they sent. */
export interface PaymentProofPM {
  reference: string;
  amountKobo: number;
  senderBankName: string;
  senderAccountName: string;
  senderAccountNumber: string;
}

export interface PaymentPM {
  id: string;
  plan: "silver";
  period: PlanPeriod;
  status: PaymentStatus;
  reference: string;
  amountKobo: number;
  usdCents: number;
  bank: BankAccountPM;
  expiresAt: string;
  proofUntil: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  proof: PaymentProofPM | null;
  createdAt: string;
}

export interface SubscriptionStatusPM {
  plan: "basic" | "silver";
  silverUntil: string | null;
  available: boolean;
  prices: PlanPricesPM;
  open: PaymentPM | null;
  rejected: PaymentPM | null;
}

export interface SubmitPaymentPM extends PaymentProofPM {
  receiptKey: string;
}

export interface AdminPaymentPM extends PaymentPM {
  member: { userId: string; username: string | null; displayName: string } | null;
  receipt: { url: string } | null;
}

export interface PaymentSettingsPM {
  bank: BankAccountPM | null;
  prices: PlanPricesPM;
  canEdit: boolean;
  updatedAt: string | null;
}

export interface PaymentSettingsInputPM {
  bankName: string;
  accountName: string;
  accountNumber: string;
  monthlyKobo: number;
  yearlyKobo: number;
  monthlyUsdCents: number;
  yearlyUsdCents: number;
}

const WHOLE = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });
const CENTS = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 3_364_700 -> "33,647", 3_364_750 -> "33,647.50": kobo only when there are some. */
export function nairaDigits(kobo: number): string {
  return (kobo % 100 === 0 ? WHOLE : CENTS).format(kobo / 100);
}

/** 3_364_700 -> "₦33,647". */
export function naira(kobo: number): string {
  return `₦${nairaDigits(kobo)}`;
}

/** 2400 -> "$24", 2403 -> "$24.03". */
export function usd(cents: number): string {
  return `$${(cents % 100 === 0 ? WHOLE : CENTS).format(cents / 100)}`;
}

/** What a member typed for an amount, in kobo: "₦33,647" or "33647.50"; null if it isn't one. */
export function parseNaira(input: string): number | null {
  const clean = input.replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const kobo = Math.round(Number(clean) * 100);
  return kobo > 0 ? kobo : null;
}

/** Milliseconds left as the transfer screen shows them: "01:00:00", never negative. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** What a year saves against twelve months, in whole percent: $24 against $48 is 50. */
export function savePercent(prices: PlanPricesPM): number {
  const list = prices.monthly.usdCents * 12;
  return list > 0 ? Math.max(0, Math.round((1 - prices.yearly.usdCents / list) * 100)) : 0;
}

/** The yearly plan's price at the monthly rate, struck through beside it: $48. */
export function yearlyListPrice(prices: PlanPricesPM): number {
  return prices.monthly.usdCents * 12;
}

const BANK_COLOURS: Record<string, string> = { UBA: "#D71920" };
const MINOR_WORDS = new Set(["of", "and", "plc", "ltd", "limited", "&"]);

/** The badge a bank's name gets in place of a logo: "UBA", "Access Bank" -> "AB". */
export function bankBadge(name: string): { text: string; colour: string } {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter((w) => !MINOR_WORDS.has(w.toLowerCase()));
  const text =
    trimmed.length <= 4
      ? trimmed.toUpperCase()
      : words
          .slice(0, 3)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("");
  return { text, colour: BANK_COLOURS[trimmed.toUpperCase()] ?? "#3F3F46" };
}

/** "6 Nov 2026", in Lagos. */
export function planDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

/** A payment still in the member's hands: being paid, or proof not yet sent. */
export function takesProof(p: PaymentPM, now = new Date()): boolean {
  return p.status === "pending" && now < new Date(p.proofUntil);
}

export interface AdminPaymentVM {
  id: string;
  status: PaymentStatus;
  /** The name on the sending account: what the statement shows, and what the team tracks. */
  sender: string;
  senderBank: string | null;
  senderNumber: string | null;
  member: string;
  memberHref: string | null;
  plan: string;
  expected: string;
  paid: string | null;
  /** The member says they sent exactly the amount they were given. */
  amountMatches: boolean;
  reference: string;
  /** The reference they used, when it isn't ours. */
  paidReference: string | null;
  when: string;
  receiptUrl: string | null;
  reviewNote: string | null;
  canVerify: boolean;
  canReject: boolean;
}

export function toAdminPaymentVM(
  pm: AdminPaymentPM,
  memberHref: (id: string) => string,
  labels: {
    noProof: string;
    deletedAccount: string;
    periods: Record<PlanPeriod, string>;
    plan: string;
  },
  now = new Date(),
): AdminPaymentVM {
  const proof = pm.proof;
  const member = pm.member;
  return {
    id: pm.id,
    status: pm.status,
    sender: proof?.senderAccountName || labels.noProof,
    senderBank: proof?.senderBankName || null,
    senderNumber: proof?.senderAccountNumber || null,
    member: member
      ? member.username
        ? `${member.displayName} · @${member.username}`
        : member.displayName
      : labels.deletedAccount,
    memberHref: member ? memberHref(member.userId) : null,
    plan: `${labels.plan} · ${labels.periods[pm.period]}`,
    expected: naira(pm.amountKobo),
    paid: proof ? naira(proof.amountKobo) : null,
    amountMatches: proof ? proof.amountKobo === pm.amountKobo : false,
    reference: pm.reference,
    paidReference: proof && proof.reference !== pm.reference ? proof.reference : null,
    when: timeAgo(pm.submittedAt ?? pm.createdAt, now) ?? "",
    receiptUrl: pm.receipt?.url ?? null,
    reviewNote: pm.reviewNote,
    canVerify: pm.status !== "verified",
    canReject: pm.status === "submitted" || pm.status === "pending",
  };
}
