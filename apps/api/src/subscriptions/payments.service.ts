import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  memberSubscription,
  moderationLog,
  paymentSettings,
  profile,
  subscriptionPayment,
  user,
  type PaymentStatus,
} from "../db/schema";
import { containsPattern } from "../push/notifications.service";
import { PushService } from "../push/push.service";
import { StorageService } from "../storage/storage.service";
import type { AdminPaymentDto, PaymentSettingsDto, PaymentSettingsInput } from "./dto";
import { addPeriod } from "./plans";
import { expireAbandoned, readSettings, toPaymentDto } from "./subscriptions.service";

const LIST_LIMIT = 100;

/** The client or an open transaction: both run the same queries. */
type Queryable = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Silver payments, the admins' side: the queue of proofs to check against the
 * bank statement, the decision on each, and where members are told to pay.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly push: PushService,
  ) {}

  /**
   * Payments in one state. Proofs waiting for a decision read oldest first, so
   * nobody waits longest; the rest newest first. `q` finds a payment by the
   * name on the sending account (what the statement shows), a reference, an
   * account number or the member.
   */
  async list(status: PaymentStatus, q?: string): Promise<AdminPaymentDto[]> {
    await expireAbandoned(this.db);
    const filters: SQL[] = [eq(subscriptionPayment.status, status)];
    if (q) {
      const like = containsPattern(q);
      filters.push(
        or(
          ilike(subscriptionPayment.senderAccountName, like),
          ilike(subscriptionPayment.reference, like),
          ilike(subscriptionPayment.paidReference, like),
          ilike(subscriptionPayment.senderAccountNumber, like),
          ilike(user.username, like),
          ilike(profile.displayName, like),
        ) as SQL,
      );
    }
    const rows = await this.db
      .select({
        payment: subscriptionPayment,
        userId: user.id,
        username: user.username,
        name: user.name,
        displayName: profile.displayName,
      })
      .from(subscriptionPayment)
      .leftJoin(user, eq(user.id, subscriptionPayment.userId))
      .leftJoin(profile, eq(profile.userId, subscriptionPayment.userId))
      .where(and(...filters))
      .orderBy(
        status === "submitted"
          ? asc(subscriptionPayment.submittedAt)
          : desc(subscriptionPayment.createdAt),
      )
      .limit(LIST_LIMIT);
    return Promise.all(
      rows.map(async (r) => ({
        ...toPaymentDto(r.payment),
        member: r.userId
          ? {
              userId: r.userId,
              username: r.username,
              displayName: r.displayName ?? r.username ?? r.name ?? "Member",
            }
          : null,
        receipt: r.payment.receiptKey
          ? { url: await this.storage.presignDownload(r.payment.receiptKey) }
          : null,
      })),
    );
  }

  /**
   * The money arrived: Silver turns on, or runs on from where it ends now.
   * Any payment not already verified can be (an admin may find a transfer
   * whose proof never came), and only once, however many admins press it.
   */
  async verify(actorId: string, id: string): Promise<{ id: string; silverUntil: string }> {
    const result = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(subscriptionPayment)
        .set({ status: "verified", reviewedBy: actorId, reviewedAt: new Date(), reviewNote: null })
        .where(
          and(
            eq(subscriptionPayment.id, id),
            inArray(subscriptionPayment.status, ["submitted", "pending", "expired", "rejected"]),
          ),
        )
        .returning();
      if (!row) throw await this.missing(tx, id, "verified");
      const [member] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, row.userId))
        .limit(1);
      if (!member) throw new NotFoundException("This member's account no longer exists.");
      const [current] = await tx
        .select({ end: memberSubscription.currentPeriodEnd })
        .from(memberSubscription)
        .where(eq(memberSubscription.userId, row.userId))
        .for("update")
        .limit(1);
      const now = new Date();
      const from = current && current.end > now ? current.end : now;
      const until = addPeriod(from, row.period);
      await tx
        .insert(memberSubscription)
        .values({ userId: row.userId, plan: row.plan, currentPeriodEnd: until })
        .onConflictDoUpdate({
          target: memberSubscription.userId,
          set: { plan: row.plan, currentPeriodEnd: until, updatedAt: now },
        });
      await tx.insert(moderationLog).values({
        actorId,
        action: "payment_verified",
        subjectUserId: row.userId,
        detail: id,
      });
      return { userId: row.userId, until };
    });
    this.push.paymentVerified(result.userId, id);
    return { id, silverUntil: result.until.toISOString() };
  }

  /** The transfer couldn't be matched. The member reads `reason` and can pay again. */
  async reject(actorId: string, id: string, reason: string): Promise<{ id: string }> {
    const [row] = await this.db
      .update(subscriptionPayment)
      .set({
        status: "rejected",
        reviewedBy: actorId,
        reviewedAt: new Date(),
        reviewNote: reason,
      })
      .where(
        and(
          eq(subscriptionPayment.id, id),
          inArray(subscriptionPayment.status, ["submitted", "pending"]),
        ),
      )
      .returning({ userId: subscriptionPayment.userId });
    if (!row) throw await this.missing(this.db, id, "rejected");
    await this.db.insert(moderationLog).values({
      actorId,
      action: "payment_rejected",
      subjectUserId: row.userId,
      detail: `${id}: ${reason}`,
    });
    this.push.paymentRejected(row.userId, id);
    return { id };
  }

  async settings(canEdit: boolean): Promise<PaymentSettingsDto> {
    const s = await readSettings(this.db);
    return {
      bank: s.bank,
      prices: s.prices,
      canEdit,
      updatedAt: s.updatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Where members pay, and the prices. Open checkouts keep the account they
   * were shown; new ones use this.
   */
  async updateSettings(actorId: string, input: PaymentSettingsInput): Promise<PaymentSettingsDto> {
    const values = { ...input, updatedBy: actorId, updatedAt: new Date() };
    await this.db
      .insert(paymentSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: paymentSettings.id, set: values });
    await this.db.insert(moderationLog).values({
      actorId,
      action: "payment_settings_updated",
      detail: `${input.bankName} ${input.accountNumber} (${input.accountName})`,
    });
    return this.settings(true);
  }

  /**
   * Why a decision didn't apply: no such payment, or it's already been decided.
   * Asked on the caller's connection, so a transaction never waits on a second one.
   */
  private async missing(q: Queryable, id: string, wanted: "verified" | "rejected") {
    const [row] = await q
      .select({ status: subscriptionPayment.status })
      .from(subscriptionPayment)
      .where(eq(subscriptionPayment.id, id))
      .limit(1);
    if (!row) return new NotFoundException("Payment not found.");
    return new ConflictException(
      row.status === wanted
        ? `This payment is already ${wanted}.`
        : `This payment is ${row.status} and can't be ${wanted}.`,
    );
  }
}
