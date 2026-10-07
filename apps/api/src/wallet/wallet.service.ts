import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  moderationLog,
  walletBalance,
  walletBank,
  walletLedger,
  walletOperation,
  walletSettings,
} from "../db/schema";
import { StorageService } from "../storage/storage.service";
import { readSettings } from "../subscriptions/subscriptions.service";
import { nextWalletStatus, PACKS, walletAmount, walletPaymentReference } from "./rules";
import {
  walletBankSchema,
  walletDecisionSchema,
  walletProofSchema,
  walletRequestSchema,
  walletSettingsSchema,
} from "./dto";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Operation = typeof walletOperation.$inferSelect;
const receiptTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const maxReceipt = 10 * 1024 * 1024;
const receiptPrefix = (userId: string, id: string) => `wallet-receipts/${userId}/${id}/`;
const lock = (tx: Tx, userId: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"wallet:" + userId}))`);
export function walletOperationDto(row: Operation) {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

@Injectable()
export class WalletService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}
  async settings() {
    const [row] = await this.db.select().from(walletSettings).where(eq(walletSettings.id, 1));
    const payment = await readSettings(this.db);
    return {
      currency: "NGN" as const,
      enabled: !!row?.enabled && !!payment.bank,
      rates: row?.rates ?? null,
      minimumKobo: row?.minimumKobo ?? null,
      bank: payment.bank,
      packs: PACKS,
    };
  }
  async saveSettings(actorId: string, input: z.infer<typeof walletSettingsSchema>) {
    if (input.enabled && !(await readSettings(this.db)).bank)
      throw new BadRequestException("Configure the payment bank account in Payments first.");
    await this.db.transaction(async (tx) => {
      await tx
        .insert(walletSettings)
        .values({
          id: 1,
          rates: input.rates,
          minimumKobo: input.minimumKobo,
          enabled: input.enabled ? 1 : 0,
          updatedBy: actorId,
        })
        .onConflictDoUpdate({
          target: walletSettings.id,
          set: {
            rates: input.rates,
            minimumKobo: input.minimumKobo,
            enabled: input.enabled ? 1 : 0,
            updatedBy: actorId,
            updatedAt: new Date(),
          },
        });
      await tx
        .insert(moderationLog)
        .values({ actorId, action: "wallet_settings_updated", detail: JSON.stringify(input) });
    });
    return this.settings();
  }
  async balances(userId: string) {
    const rows = await this.db.select().from(walletBalance).where(eq(walletBalance.userId, userId));
    return (["coin", "star", "crown"] as const).map((currency) => ({
      currency,
      available: rows.find((row) => row.currency === currency)?.available ?? 0,
      reserved: rows.find((row) => row.currency === currency)?.reserved ?? 0,
    }));
  }
  async banks(userId: string) {
    return this.db
      .select()
      .from(walletBank)
      .where(eq(walletBank.userId, userId))
      .orderBy(desc(walletBank.isDefault), asc(walletBank.createdAt));
  }
  async addBank(userId: string, input: z.infer<typeof walletBankSchema>) {
    await this.db.transaction(async (tx) => {
      await lock(tx, userId);
      const current = await tx.select().from(walletBank).where(eq(walletBank.userId, userId));
      if (current.length >= 10)
        throw new BadRequestException("You can save up to 10 bank accounts.");
      if (
        current.some(
          (row) =>
            row.accountNumber === input.accountNumber &&
            row.bankName.toLowerCase() === input.bankName.toLowerCase(),
        )
      )
        throw new ConflictException("That bank account is already saved.");
      await tx
        .insert(walletBank)
        .values({ ...input, userId, isDefault: current.length === 0 ? 1 : 0 });
    });
    return this.banks(userId);
  }
  async changeBank(userId: string, id: string, remove: boolean) {
    await this.db.transaction(async (tx) => {
      await lock(tx, userId);
      const [bank] = await tx
        .select()
        .from(walletBank)
        .where(and(eq(walletBank.id, id), eq(walletBank.userId, userId)));
      if (!bank) throw new NotFoundException("Bank account not found.");
      if (remove) {
        await tx.delete(walletBank).where(eq(walletBank.id, id));
        if (bank.isDefault) {
          const [next] = await tx
            .select()
            .from(walletBank)
            .where(eq(walletBank.userId, userId))
            .orderBy(asc(walletBank.createdAt))
            .limit(1);
          if (next)
            await tx.update(walletBank).set({ isDefault: 1 }).where(eq(walletBank.id, next.id));
        }
      } else {
        await tx.update(walletBank).set({ isDefault: 0 }).where(eq(walletBank.userId, userId));
        await tx.update(walletBank).set({ isDefault: 1 }).where(eq(walletBank.id, id));
      }
    });
    return this.banks(userId);
  }
  async history(userId: string) {
    return (
      await this.db
        .select()
        .from(walletOperation)
        .where(eq(walletOperation.userId, userId))
        .orderBy(desc(walletOperation.createdAt))
        .limit(200)
    ).map(walletOperationDto);
  }
  async operation(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(walletOperation)
      .where(and(eq(walletOperation.id, id), eq(walletOperation.userId, userId)));
    if (!row) throw new NotFoundException("Wallet transaction not found.");
    return row;
  }
  async create(
    userId: string,
    kind: "purchase" | "withdrawal",
    input: z.infer<typeof walletRequestSchema> & { bankId?: string },
  ) {
    const result = await this.db.transaction(async (tx) => {
      await lock(tx, userId);
      const [existing] = await tx
        .select()
        .from(walletOperation)
        .where(
          and(eq(walletOperation.userId, userId), eq(walletOperation.requestKey, input.requestKey)),
        );
      if (existing) {
        if (
          existing.kind !== kind ||
          existing.currency !== input.currency ||
          existing.quantity !== input.quantity
        )
          throw new ConflictException("Request key already used for another transaction.");
        if (kind === "withdrawal") {
          const [requestedBank] = await tx
            .select()
            .from(walletBank)
            .where(and(eq(walletBank.id, input.bankId!), eq(walletBank.userId, userId)));
          if (
            !requestedBank ||
            requestedBank.bankName !== existing.bankName ||
            requestedBank.accountName !== existing.accountName ||
            requestedBank.accountNumber !== existing.accountNumber
          )
            throw new ConflictException("Request key already used with different bank details.");
        }
        return existing;
      }
      const [config] = await tx.select().from(walletSettings).where(eq(walletSettings.id, 1));
      if (!config?.enabled)
        throw new ServiceUnavailableException("Wallet transactions are not enabled yet.");
      const amountKobo = walletAmount(
        config.rates,
        input.currency,
        input.quantity,
        kind,
        config.minimumKobo,
      );
      let bank: { bankName: string; accountName: string; accountNumber: string };
      if (kind === "purchase") {
        const payment = await readSettings(tx as unknown as Db);
        if (!payment.bank)
          throw new ServiceUnavailableException("Payment bank account is not configured.");
        bank = {
          bankName: payment.bank.name,
          accountName: payment.bank.accountName,
          accountNumber: payment.bank.accountNumber,
        };
      } else {
        const [saved] = await tx
          .select()
          .from(walletBank)
          .where(and(eq(walletBank.id, input.bankId!), eq(walletBank.userId, userId)));
        if (!saved) throw new NotFoundException("Choose one of your saved bank accounts.");
        bank = saved;
        const changed = await tx
          .update(walletBalance)
          .set({
            available: sql`${walletBalance.available}-${input.quantity}`,
            reserved: sql`${walletBalance.reserved}+${input.quantity}`,
          })
          .where(
            and(
              eq(walletBalance.userId, userId),
              eq(walletBalance.currency, input.currency),
              gte(walletBalance.available, input.quantity),
            ),
          )
          .returning();
        if (!changed.length) throw new ConflictException("Insufficient available balance.");
      }
      let reference = `KRD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      if (kind === "purchase") {
        // Serialize allocation across members and API instances until the insert commits.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('wallet:payment-reference'))`);
        const at = new Date();
        const first = walletPaymentReference(at, new Set());
        const used = await tx
          .select({ reference: walletOperation.reference })
          .from(walletOperation)
          .where(and(eq(walletOperation.kind, "purchase"), gte(walletOperation.reference, first)));
        reference = walletPaymentReference(at, new Set(used.map((row) => row.reference)));
      }
      const [row] = await tx
        .insert(walletOperation)
        .values({
          userId,
          kind,
          currency: input.currency,
          quantity: input.quantity,
          requestKey: input.requestKey,
          amountKobo,
          ...{
            bankName: bank.bankName,
            accountName: bank.accountName,
            accountNumber: bank.accountNumber,
          },
          reference,
        })
        .returning();
      if (kind === "withdrawal")
        await tx.insert(walletLedger).values({
          operationId: row.id,
          userId,
          currency: input.currency,
          phase: "hold",
          availableDelta: -input.quantity,
          reservedDelta: input.quantity,
        });
      return row;
    });
    return walletOperationDto(result);
  }
  async receiptUpload(userId: string, id: string, contentType: string, size: number) {
    const row = await this.operation(userId, id);
    if (row.kind !== "purchase" || row.status !== "pending")
      throw new ConflictException("This payment is not waiting for proof.");
    const extension = receiptTypes[contentType];
    if (!extension || size < 1 || size > maxReceipt)
      throw new BadRequestException("Upload a JPEG, PNG or WebP receipt of up to 10 MB.");
    const key = `${receiptPrefix(userId, id)}${randomUUID()}.${extension}`;
    return { key, uploadUrl: await this.storage.presignUpload(key, contentType, size) };
  }
  async submit(userId: string, id: string, input: z.infer<typeof walletProofSchema>) {
    const before = await this.operation(userId, id);
    if (
      before.status === "submitted" &&
      before.receiptKey === input.receiptKey &&
      before.senderReference === input.senderReference &&
      before.senderAccountName === input.senderAccountName
    )
      return walletOperationDto(before);
    if (before.kind !== "purchase" || before.status !== "pending")
      throw new ConflictException("This payment no longer accepts proof.");
    if (!input.receiptKey.startsWith(receiptPrefix(userId, id)))
      throw new BadRequestException("Upload a receipt for this payment.");
    const info = await this.storage.describe(input.receiptKey);
    if (!info || info.size < 1 || info.size > maxReceipt || !receiptTypes[info.contentType ?? ""])
      throw new BadRequestException("Receipt upload is missing or invalid.");
    const [row] = await this.db
      .update(walletOperation)
      .set({ ...input, status: "submitted", updatedAt: new Date() })
      .where(
        and(
          eq(walletOperation.id, id),
          eq(walletOperation.userId, userId),
          eq(walletOperation.status, "pending"),
        ),
      )
      .returning();
    if (!row) throw new ConflictException("This payment has changed. Refresh and try again.");
    return walletOperationDto(row);
  }
  async queue(kind?: "purchase" | "withdrawal", status?: Operation["status"]) {
    const rows = await this.db
      .select()
      .from(walletOperation)
      .where(
        and(
          kind ? eq(walletOperation.kind, kind) : undefined,
          status ? eq(walletOperation.status, status) : undefined,
        ),
      )
      .orderBy(asc(walletOperation.createdAt))
      .limit(200);
    return Promise.all(
      rows.map(async (row) => ({
        ...walletOperationDto(row),
        receiptUrl: row.receiptKey ? await this.storage.presignDownload(row.receiptKey) : null,
      })),
    );
  }
  async decide(actorId: string, id: string, input: z.infer<typeof walletDecisionSchema>) {
    try {
      const result = await this.db.transaction(async (tx) => {
        const [lookup] = await tx.select().from(walletOperation).where(eq(walletOperation.id, id));
        if (!lookup) throw new NotFoundException("Wallet transaction not found.");
        if (lookup.userId === actorId)
          throw new ForbiddenException("Another admin must review your own wallet transactions.");
        await lock(tx, lookup.userId);
        const [row] = await tx
          .select()
          .from(walletOperation)
          .where(eq(walletOperation.id, id))
          .for("update");
        const status = nextWalletStatus(row.kind, row.status, input.action);
        const [updated] = await tx
          .update(walletOperation)
          .set({
            status,
            reviewNote: input.note ?? null,
            reviewedBy: actorId,
            updatedAt: new Date(),
            ...(input.bankReference
              ? { settlementReference: input.bankReference, paidBy: actorId }
              : {}),
          })
          .where(eq(walletOperation.id, id))
          .returning();
        if (status === "verified") {
          await tx
            .insert(walletBalance)
            .values({
              userId: row.userId,
              currency: row.currency,
              available: row.quantity,
              reserved: 0,
            })
            .onConflictDoUpdate({
              target: [walletBalance.userId, walletBalance.currency],
              set: { available: sql`${walletBalance.available}+${row.quantity}` },
            });
          await tx.insert(walletLedger).values({
            operationId: id,
            userId: row.userId,
            currency: row.currency,
            phase: "credit",
            availableDelta: row.quantity,
            reservedDelta: 0,
          });
        }
        if (row.kind === "withdrawal" && (status === "paid" || status === "rejected")) {
          const released = status === "rejected" ? row.quantity : 0;
          const changed = await tx
            .update(walletBalance)
            .set({
              available: sql`${walletBalance.available}+${released}`,
              reserved: sql`${walletBalance.reserved}-${row.quantity}`,
            })
            .where(
              and(
                eq(walletBalance.userId, row.userId),
                eq(walletBalance.currency, row.currency),
                gte(walletBalance.reserved, row.quantity),
              ),
            )
            .returning();
          if (!changed.length)
            throw new ConflictException(
              "Reserved balance is inconsistent. Do not pay this request; contact the lead.",
            );
          await tx.insert(walletLedger).values({
            operationId: id,
            userId: row.userId,
            currency: row.currency,
            phase: status === "paid" ? "paid" : "release",
            availableDelta: released,
            reservedDelta: -row.quantity,
          });
        }
        await tx.insert(moderationLog).values({
          actorId,
          action: `wallet_${input.action}`,
          subjectUserId: row.userId,
          detail: JSON.stringify({
            id,
            reference: row.reference,
            bankReference: input.bankReference ?? null,
            note: input.note ?? null,
          }),
        });
        return updated;
      });
      return walletOperationDto(result);
    } catch (e) {
      const err = e as { code?: string; cause?: { code?: string } };
      if (err.code === "23505" || err.cause?.code === "23505")
        throw new ConflictException("That transfer reference has already been recorded.");
      throw e;
    }
  }
}
