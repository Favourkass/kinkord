import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";

export const ringQuantitySchema = z.number().int().min(2).max(100).multipleOf(2);
export const ringCheckoutSchema = z
  .object({
    quantity: ringQuantitySchema,
    senderId: z.string().min(1).max(128),
    method: z.enum(["bank", "coins"]),
    requestKey: z.string().uuid(),
    expectedAmountKobo: z.number().int().positive(),
    expectedCoins: z.number().int().positive().nullable(),
  })
  .strict();
export const PURCHASED_RING_DAYS = 90;

/** Whole coins only: round up to cover the USD price at the configured buy rate. */
export function ringPrice(quantity: number, exchangeRateKobo: number, coinUsdCents: number | null) {
  if (!ringQuantitySchema.safeParse(quantity).success)
    throw new BadRequestException("Choose 2 to 100 rings, in multiples of 2.");
  if (!Number.isSafeInteger(exchangeRateKobo) || exchangeRateKobo <= 0)
    throw new ServiceUnavailableException("The exchange rate is not configured.");
  const usdCents = (quantity / 2) * 500;
  const amountKobo = Math.round((usdCents * exchangeRateKobo) / 100);
  if (!Number.isSafeInteger(amountKobo) || amountKobo > 1_000_000_000)
    throw new BadRequestException("Choose fewer rings.");
  const coins =
    coinUsdCents !== null && Number.isFinite(coinUsdCents) && coinUsdCents > 0
      ? Math.ceil(usdCents / coinUsdCents)
      : null;
  if (coins !== null && (!Number.isSafeInteger(coins) || coins > 2_147_483_647))
    throw new ServiceUnavailableException("The coin rate is not available.");
  return { quantity, usdCents, amountKobo, coins };
}

/** Bank payments start their usable 90-day period when approved; coin payments immediately. */
export function purchasedRings(quantity: number, at: Date) {
  ringQuantitySchema.parse(quantity);
  return Array.from({ length: quantity }, (_, i) => ({
    seq: i + 1,
    expiresAt: new Date(at.getTime() + PURCHASED_RING_DAYS * 86_400_000),
  }));
}
