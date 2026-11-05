import { sameSender } from "../wallet/rules";
import { ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { kinkRing, subscriptionPayment, walletBalance, walletSettings } from "../db/schema";
import { z } from "zod";
import { purchasedRings, ringCheckoutSchema, ringPrice } from "./ring-purchases.rules";
import { ringPairPrice } from "./ring-settings";
import { expireAbandoned, readSettings, toPaymentDto } from "./subscriptions.service";
import { paymentReference } from "./plans";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

@Injectable()
export class RingPurchasesService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  private async pricing(db: Db | Tx, quantity: number) {
    const [config] = await db.select().from(walletSettings).where(eq(walletSettings.id, 1));
    if (!config) throw new ServiceUnavailableException("Ring purchases are not configured yet.");
    // The founders' price for 2 rings, read inside the checkout's transaction.
    const pairUsdCents = await ringPairPrice(db);
    const price = ringPrice(
      quantity,
      config.exchangeRateKobo,
      config.enabled ? config.usdRates.coin.buy : null,
      pairUsdCents,
    );
    const settings = await readSettings(db as Db);
    return { ...price, pairUsdCents, bank: settings.bank };
  }

  async quote(userId: string, quantity: number) {
    const [price, balance, available] = await Promise.all([
      this.pricing(this.db, quantity),
      this.db
        .select()
        .from(walletBalance)
        .where(and(eq(walletBalance.userId, userId), eq(walletBalance.currency, "coin"))),
      this.db
        .select({ n: count() })
        .from(kinkRing)
        .where(
          and(
            eq(kinkRing.ownerId, userId),
            isNull(kinkRing.givenAt),
            isNull(kinkRing.revokedAt),
            gt(kinkRing.expiresAt, new Date()),
          ),
        ),
    ]);
    return {
      userId,
      quantity: price.quantity,
      pairUsdCents: price.pairUsdCents,
      usdCents: price.usdCents,
      amountKobo: price.amountKobo,
      coins: price.coins,
      coinBalance: balance[0]?.available ?? 0,
      availableRings: Number(available[0]?.n ?? 0),
      bankAvailable: !!price.bank,
    };
  }

  async history(userId: string, page = 1) {
    const rows = await this.db
      .select()
      .from(subscriptionPayment)
      .where(and(eq(subscriptionPayment.userId, userId), eq(subscriptionPayment.purpose, "rings")))
      .orderBy(desc(subscriptionPayment.createdAt), desc(subscriptionPayment.id))
      .limit(21)
      .offset((page - 1) * 20);
    return {
      items: rows.slice(0, 20).map((r) => toPaymentDto(r)),
      nextPage: rows.length > 20 ? page + 1 : null,
    };
  }

  async checkout(userId: string, raw: z.infer<typeof ringCheckoutSchema>) {
    const input = ringCheckoutSchema.parse(raw);
    sameSender(userId, input.senderId);
    const result = await this.db.transaction(async (tx) => {
      // Same lock used by gifts/withdrawals: never spend a balance concurrently.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"wallet:" + userId}))`);
      const [existing] = await tx
        .select()
        .from(subscriptionPayment)
        .where(
          and(
            eq(subscriptionPayment.userId, userId),
            eq(subscriptionPayment.requestKey, input.requestKey),
          ),
        );
      if (existing) {
        if (
          existing.purpose !== "rings" ||
          existing.ringQuantity !== input.quantity ||
          existing.method !== input.method
        )
          throw new ConflictException("Request key already used for another purchase.");
        return existing;
      }
      const price = await this.pricing(tx, input.quantity);
      if (
        price.amountKobo !== input.expectedAmountKobo ||
        (input.method === "coins" && price.coins !== input.expectedCoins)
      )
        throw new ConflictException("The price has changed. Refresh and review the new total.");
      if (input.method === "coins" && price.coins === null)
        throw new ServiceUnavailableException("KinkCoin payments are not enabled.");
      if (input.method === "bank" && !price.bank)
        throw new ServiceUnavailableException("Bank transfers are not configured.");
      const now = new Date();
      // Allocate a unique bank amount across Silver AND ring payments. The existing unique
      // index also protects against concurrent Silver checkout, which can be safely retried.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ring-purchase-reference'))`);
      if (input.method === "bank") await expireAbandoned(tx as Db, now);
      const used = await tx
        .select({
          reference: subscriptionPayment.reference,
          amount: subscriptionPayment.amountKobo,
        })
        .from(subscriptionPayment)
        .where(inArray(subscriptionPayment.status, ["pending", "submitted"]))
        .orderBy(asc(subscriptionPayment.amountKobo));
      let amountKobo = price.amountKobo;
      if (input.method === "bank") {
        const amounts = new Set(used.map((r) => r.amount));
        while (amounts.has(amountKobo)) amountKobo += 100;
        if (amountKobo - price.amountKobo > 99900)
          throw new ConflictException("Payments are busy. Try again shortly.");
      }
      // UUID suffix also prevents collisions with already-completed purchases.
      const reference =
        paymentReference(now).replace(/^KIN/, "KR") +
        "-" +
        input.requestKey.slice(0, 8).toUpperCase();
      let earnedCoinsSpent = 0;
      if (input.method === "coins") {
        const coins = price.coins!;
        const [balance] = await tx
          .select()
          .from(walletBalance)
          .where(and(eq(walletBalance.userId, userId), eq(walletBalance.currency, "coin")))
          .for("update");
        if (!balance || balance.available < coins)
          throw new ConflictException("Insufficient KinkCoins. Top up or choose bank transfer.");
        earnedCoinsSpent = Math.max(0, coins - (balance.available - balance.earned));
        const changed = await tx
          .update(walletBalance)
          .set({
            available: sql`${walletBalance.available} - ${coins}`,
            earned: sql`${walletBalance.earned} - ${earnedCoinsSpent}`,
          })
          .where(
            and(
              eq(walletBalance.userId, userId),
              eq(walletBalance.currency, "coin"),
              gte(walletBalance.available, coins),
            ),
          )
          .returning();
        if (!changed.length) throw new ConflictException("Insufficient KinkCoins.");
      }
      const [row] = await tx
        .insert(subscriptionPayment)
        .values({
          userId,
          purpose: "rings",
          ringQuantity: input.quantity,
          method: input.method,
          requestKey: input.requestKey,
          plan: "silver",
          period: "monthly",
          reference,
          amountKobo,
          usdCents: price.usdCents,
          coinQuantity: input.method === "coins" ? price.coins : null,
          earnedCoinsSpent: input.method === "coins" ? earnedCoinsSpent : null,
          bankName: input.method === "bank" ? price.bank!.name : "KinkCoins",
          accountName: input.method === "bank" ? price.bank!.accountName : "KinkCoin balance",
          accountNumber: input.method === "bank" ? price.bank!.accountNumber : "",
          status: input.method === "coins" ? "verified" : "pending",
          reviewedAt: input.method === "coins" ? now : null,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        })
        .returning();
      if (input.method === "coins")
        await tx.insert(kinkRing).values(
          purchasedRings(input.quantity, now).map((r) => ({
            ...r,
            ownerId: userId,
            paymentId: row.id,
          })),
        );
      return row;
    });
    return toPaymentDto(result);
  }
}
