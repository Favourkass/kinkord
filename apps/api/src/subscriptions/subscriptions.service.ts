import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { and, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  memberSubscription,
  paymentSettings,
  subscriptionPayment,
  type BillingPeriod,
} from "../db/schema";
import { founderAccounts, isSuperAdmin, type AdminCandidate } from "../moderation/admins";
import { PushService } from "../push/push.service";
import { StorageService } from "../storage/storage.service";
import type {
  BankAccountDto,
  PaymentDto,
  PlanPrices,
  SubmitPaymentInput,
  SubscriptionStatusDto,
} from "./dto";
import {
  DEFAULT_PRICES,
  FOUNDER_SILVER_UNTIL,
  PAYMENT_WINDOW_MS,
  PROOF_GRACE_MS,
  freeOffset,
  silverForGood,
  paymentReference,
  silverCheckStatus,
  silverUntil,
  usdCentsFor,
} from "./plans";

export type PaymentRow = typeof subscriptionPayment.$inferSelect;

/** A receipt is a photo of a screen or a slip; the same budget as a chat photo. */
export const RECEIPT_MAX_MB = 10;
const receiptMaxBytes = RECEIPT_MAX_MB * 1024 * 1024;
const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
/** `payments/<userId>/<paymentId>/<uuid>.jpg`: whose receipt, for which payment. */
export const RECEIPT_PREFIX = "payments";
const receiptPrefix = (userId: string, paymentId: string) =>
  `${RECEIPT_PREFIX}/${userId}/${paymentId}/`;
const receiptTooLarge = () => `Receipt is too large — max ${RECEIPT_MAX_MB}MB.`;
const receiptTypes = () => `contentType must be one of: ${Object.keys(RECEIPT_TYPES).join(", ")}`;

/** The highest offset `freeOffset` hands out, in naira. */
const MAX_OFFSET_NAIRA = 999;
const INSERT_ATTEMPTS = 5;

export interface PaymentSettings {
  bank: BankAccountDto | null;
  prices: PlanPrices;
  updatedAt: Date | null;
}

/** Postgres unique-violation, possibly wrapped by drizzle in a DrizzleQueryError. */
export const isUniqueViolation = (e: unknown): boolean => {
  const code = (e as { code?: string; cause?: { code?: string } } | null)?.code;
  const causeCode = (e as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505" || causeCode === "23505";
};

/** The settings row, or the design's prices and no account when there isn't one yet. */
export async function readSettings(db: Db): Promise<PaymentSettings> {
  const [row] = await db.select().from(paymentSettings).where(eq(paymentSettings.id, 1)).limit(1);
  if (!row) return { bank: null, prices: DEFAULT_PRICES, updatedAt: null };
  return {
    bank: { name: row.bankName, accountName: row.accountName, accountNumber: row.accountNumber },
    prices: {
      monthly: { kobo: row.monthlyKobo, usdCents: row.monthlyUsdCents },
      yearly: { kobo: row.yearlyKobo, usdCents: row.yearlyUsdCents },
    },
    updatedAt: row.updatedAt,
  };
}

/** When proof stops being taken for a payment. */
export const proofDeadline = (row: Pick<PaymentRow, "expiresAt">) =>
  new Date(row.expiresAt.getTime() + PROOF_GRACE_MS);

export function toPaymentDto(row: PaymentRow, now: Date = new Date()): PaymentDto {
  const proofUntil = proofDeadline(row);
  const lapsed = row.status === "pending" && now > proofUntil;
  return {
    id: row.id,
    plan: row.plan,
    period: row.period,
    status: lapsed ? "expired" : row.status,
    reference: row.reference,
    amountKobo: row.amountKobo,
    usdCents: row.usdCents,
    bank: { name: row.bankName, accountName: row.accountName, accountNumber: row.accountNumber },
    expiresAt: row.expiresAt.toISOString(),
    proofUntil: proofUntil.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    proof:
      row.submittedAt && row.paidAmountKobo !== null
        ? {
            reference: row.paidReference ?? "",
            amountKobo: row.paidAmountKobo,
            senderBankName: row.senderBankName ?? "",
            senderAccountName: row.senderAccountName ?? "",
            senderAccountNumber: row.senderAccountNumber ?? "",
          }
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Lets go of abandoned checkouts: a pending payment past its proof deadline
 * holds an amount nobody will pay, so it's marked expired and the amount is
 * free for the next member.
 */
export async function expireAbandoned(db: Db, now: Date = new Date()): Promise<void> {
  await db
    .update(subscriptionPayment)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscriptionPayment.status, "pending"),
        lt(subscriptionPayment.expiresAt, new Date(now.getTime() - PROOF_GRACE_MS)),
      ),
    );
}

/**
 * Silver by bank transfer, the member's side: a checkout with an amount only
 * they are paying, then their proof, which an admin checks against the
 * statement before Silver turns on.
 */
@Injectable()
export class SubscriptionsService implements OnApplicationBootstrap {
  private readonly log = new Logger(SubscriptionsService.name);

  /** Swapped in specs to pick a known offset. */
  random: () => number = Math.random;

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly push: PushService,
  ) {}

  /**
   * When this member's Silver runs out, or null on Basic. The founders (the
   * verified emails in SUPER_ADMIN_EMAILS) have Silver without paying, by their
   * email like their admin rights: the first time they open the app without
   * it, they're put on it, so nobody has to add them by hand.
   */
  async silverUntil(
    who: Pick<AdminCandidate, "id" | "email" | "emailVerified">,
  ): Promise<Date | null> {
    const until = await silverUntil(this.db, who.id);
    if (!isSuperAdmin(who) || (until && until >= FOUNDER_SILVER_UNTIL)) return until;
    const now = new Date();
    try {
      await this.db
        .insert(memberSubscription)
        .values({
          userId: who.id,
          plan: "silver",
          currentPeriodEnd: FOUNDER_SILVER_UNTIL,
          startedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: memberSubscription.userId,
          // A founder who was already paying keeps the date their Silver began.
          set: {
            plan: "silver",
            currentPeriodEnd: FOUNDER_SILVER_UNTIL,
            updatedAt: now,
            ...(until ? {} : { startedAt: now }),
          },
        });
      return FOUNDER_SILVER_UNTIL;
    } catch (e) {
      // Never stop a founder opening the app: they get Silver on a later visit.
      this.log.warn(`putting a founder on Silver failed: ${String(e)}`);
      return until;
    }
  }

  /** On start, every founder is on Silver, whether or not they've opened the app since. */
  async onApplicationBootstrap(): Promise<void> {
    await this.putFoundersOnSilver();
  }

  /** Puts every founder on Silver and logs, by id, where each one's check stands. Never throws. */
  async putFoundersOnSilver(): Promise<void> {
    try {
      for (const founder of await founderAccounts(this.db)) {
        if (silverForGood(await this.silverUntil(founder))) {
          // Nothing to pay: a checkout they started, to try it say, is let go.
          await this.db
            .update(subscriptionPayment)
            .set({ status: "expired" })
            .where(
              and(
                eq(subscriptionPayment.userId, founder.id),
                eq(subscriptionPayment.status, "pending"),
              ),
            );
        }
        const check = await silverCheckStatus(this.db, founder.id);
        const state = check ? (check.shown ? "shown" : `hidden (${check.reason})`) : "no Silver";
        this.log.log(`founder ${founder.id}: check ${state}`);
      }
    } catch (e) {
      this.log.warn(`putting the founders on Silver failed: ${String(e)}`);
    }
  }

  /** The member's plan, the prices, and the payment they're in the middle of, if any. */
  async status(
    who: Pick<AdminCandidate, "id" | "email" | "emailVerified">,
  ): Promise<SubscriptionStatusDto> {
    const userId = who.id;
    const now = new Date();
    // First, so a founder put on Silver here sees it in this same answer.
    const until = await this.silverUntil(who);
    const [settings, recent, check] = await Promise.all([
      readSettings(this.db),
      this.db
        .select()
        .from(subscriptionPayment)
        .where(eq(subscriptionPayment.userId, userId))
        .orderBy(desc(subscriptionPayment.createdAt))
        .limit(5),
      silverCheckStatus(this.db, userId, now),
    ]);
    const payments = recent.map((row) => toPaymentDto(row, now));
    const open = payments.find((p) => p.status === "pending" || p.status === "submitted") ?? null;
    const latest = payments[0];
    const forGood = silverForGood(until);
    return {
      plan: until ? "silver" : "basic",
      silverUntil: until?.toISOString() ?? null,
      check: check
        ? {
            shown: check.shown,
            reason: check.reason,
            heldFor: check.heldFor,
            showsFrom: check.showsFrom?.toISOString() ?? null,
          }
        : null,
      forGood,
      available: settings.bank !== null,
      prices: settings.prices,
      // Silver for good has nothing to pay: no payment to finish, nor one to retry.
      open: forGood ? null : open,
      rejected: !forGood && latest?.status === "rejected" ? latest : null,
    };
  }

  /**
   * Starts paying for Silver, or picks up the checkout already running for the
   * same plan. Anything else the member had open is let go, so one member
   * never holds two amounts.
   */
  async checkout(userId: string, period: BillingPeriod): Promise<PaymentDto> {
    if (silverForGood(await silverUntil(this.db, userId))) {
      throw new ConflictException("You're on Silver for good, so there's nothing to pay.");
    }
    const settings = await readSettings(this.db);
    if (!settings.bank) {
      throw new ConflictException("Silver isn't open for payment yet. Check back soon.");
    }
    const now = new Date();
    const mine = await this.db
      .select()
      .from(subscriptionPayment)
      .where(
        and(
          eq(subscriptionPayment.userId, userId),
          inArray(subscriptionPayment.status, ["pending", "submitted"]),
        ),
      )
      .orderBy(desc(subscriptionPayment.createdAt));
    if (mine.some((p) => p.status === "submitted")) {
      throw new ConflictException(
        "We're still checking your last payment. We'll let you know as soon as it's confirmed.",
      );
    }
    const running = mine.find((p) => p.period === period && p.expiresAt > now);
    if (running) return toPaymentDto(running, now);
    if (mine.length) {
      await this.db
        .update(subscriptionPayment)
        .set({ status: "expired" })
        .where(
          and(eq(subscriptionPayment.userId, userId), eq(subscriptionPayment.status, "pending")),
        );
    }
    await expireAbandoned(this.db, now);

    const price = settings.prices[period];
    const bank = settings.bank;
    for (let attempt = 0; attempt < INSERT_ATTEMPTS; attempt++) {
      const amountKobo = await this.uniqueAmount(price.kobo);
      try {
        const [row] = await this.db
          .insert(subscriptionPayment)
          .values({
            userId,
            plan: "silver",
            period,
            // Two members in the same second: the second takes the next one.
            reference: paymentReference(new Date(now.getTime() + attempt * 1000)),
            amountKobo,
            usdCents: usdCentsFor(amountKobo, price),
            bankName: bank.name,
            accountName: bank.accountName,
            accountNumber: bank.accountNumber,
            expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MS),
          })
          .returning();
        return toPaymentDto(row, now);
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    }
    throw new HttpException(
      "We couldn't start your payment. Please try again.",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  async payment(userId: string, id: string): Promise<PaymentDto> {
    return toPaymentDto(await this.own(userId, id));
  }

  /** A slot to upload the receipt into, while the payment still takes proof. */
  async presignReceipt(
    userId: string,
    id: string,
    contentType: string,
    contentLength?: number,
  ): Promise<{ key: string; uploadUrl: string; expiresInSeconds: number; maxSizeMb: number }> {
    this.assertTakesProof(await this.own(userId, id));
    const ext = RECEIPT_TYPES[contentType];
    if (!ext) throw new BadRequestException(receiptTypes());
    if (contentLength !== undefined && contentLength > receiptMaxBytes) {
      throw new BadRequestException(receiptTooLarge());
    }
    const key = `${receiptPrefix(userId, id)}${randomUUID()}.${ext}`;
    return {
      key,
      uploadUrl: await this.storage.presignUpload(key, contentType, contentLength),
      expiresInSeconds: 600,
      maxSizeMb: RECEIPT_MAX_MB,
    };
  }

  /** The member's proof: the payment joins the admins' queue, and every admin hears of it. */
  async submit(userId: string, id: string, input: SubmitPaymentInput): Promise<PaymentDto> {
    this.assertTakesProof(await this.own(userId, id));
    await this.verifyReceipt(userId, id, input.receiptKey);
    const [row] = await this.db
      .update(subscriptionPayment)
      .set({
        status: "submitted",
        paidReference: input.reference,
        paidAmountKobo: input.amountKobo,
        senderBankName: input.senderBankName,
        senderAccountName: input.senderAccountName,
        senderAccountNumber: input.senderAccountNumber,
        receiptKey: input.receiptKey,
        submittedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptionPayment.id, id),
          eq(subscriptionPayment.userId, userId),
          eq(subscriptionPayment.status, "pending"),
        ),
      )
      .returning();
    if (!row) throw new ConflictException("This payment has already been sent for checking.");
    this.push.newPayment();
    return toPaymentDto(row);
  }

  private async own(userId: string, id: string): Promise<PaymentRow> {
    const [row] = await this.db
      .select()
      .from(subscriptionPayment)
      .where(and(eq(subscriptionPayment.id, id), eq(subscriptionPayment.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException("Payment not found.");
    return row;
  }

  private assertTakesProof(row: PaymentRow): void {
    if (row.status === "submitted") {
      throw new ConflictException("This payment has already been sent for checking.");
    }
    if (row.status !== "pending" || new Date() > proofDeadline(row)) {
      throw new ConflictException(
        "This payment can't take proof any more. Start a new one from the Silver page.",
      );
    }
  }

  private async verifyReceipt(userId: string, id: string, key: string): Promise<void> {
    if (!key.startsWith(receiptPrefix(userId, id))) {
      throw new BadRequestException("receipt: unknown upload");
    }
    const info = await this.storage.describe(key);
    if (!info) throw new BadRequestException("Upload your receipt again: it didn't arrive.");
    if (info.size > receiptMaxBytes) {
      await this.storage.remove(key);
      throw new BadRequestException(receiptTooLarge());
    }
    if (!info.contentType || !RECEIPT_TYPES[info.contentType]) {
      await this.storage.remove(key);
      throw new BadRequestException(receiptTypes());
    }
  }

  /** The price plus naira no open payment is using, so the statement line is this member's. */
  private async uniqueAmount(baseKobo: number): Promise<number> {
    const open = await this.db
      .select({ amountKobo: subscriptionPayment.amountKobo })
      .from(subscriptionPayment)
      .where(
        and(
          inArray(subscriptionPayment.status, ["pending", "submitted"]),
          gte(subscriptionPayment.amountKobo, baseKobo),
          lte(subscriptionPayment.amountKobo, baseKobo + MAX_OFFSET_NAIRA * 100),
        ),
      );
    const taken = new Set(open.map((r) => (r.amountKobo - baseKobo) / 100));
    const offset = freeOffset(taken, this.random);
    if (offset === null) {
      throw new HttpException(
        "A lot of members are paying right now. Try again in a few minutes.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return baseKobo + offset * 100;
  }
}
