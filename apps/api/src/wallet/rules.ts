import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { WalletCurrency, WalletRates, WalletStatus } from "../db/schema/wallet";
import { paymentReference } from "../subscriptions/plans";

/** Wallet-only prefix; retain Lagos timestamps and allocate the next free second on collision. */
export function walletPaymentReference(at: Date, taken: ReadonlySet<string>): string {
  for (let offset = 0; offset <= taken.size; offset++) {
    const reference = paymentReference(new Date(at.getTime() + offset * 1000)).replace(
      /^KIN/,
      "KKC",
    );
    if (!taken.has(reference)) return reference;
  }
  throw new ConflictException("Could not allocate a payment reference. Try again.");
}

/**
 * The member the app sent a gift or withdrawal as must be the one signed in: another tab may
 * have switched accounts. Refused before anything is read, with a code the app reads as "not
 * read", so it keeps (never clears) a request it may already have made.
 */
export function sameSender(userId: string, senderId: string | undefined) {
  if (senderId !== undefined && senderId !== userId)
    throw new ConflictException({
      code: "WRONG_ACCOUNT",
      message: "You're signed in as someone else now.",
    });
}

/**
 * Wallet transactions are switched off: refused before anything is read or moved, with a code
 * the app reads as a refusal (a definite "no"), unlike an ambiguous server error.
 */
export const walletDisabled = () =>
  new ServiceUnavailableException({
    code: "WALLET_DISABLED",
    message: "Wallet transactions are not enabled yet.",
  });

export const PACKS = {
  coin: [100, 500, 1000, 2500],
  star: [10, 50, 100, 250],
  crown: [1, 3, 5, 10],
};
export function walletAmount(
  rates: WalletRates,
  currency: WalletCurrency,
  quantity: number,
  kind: "purchase" | "withdrawal",
  minimum: number,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new BadRequestException("Enter a whole positive quantity.");
  if (kind === "purchase" && !PACKS[currency].includes(quantity))
    throw new BadRequestException("Choose an available bundle.");
  const amount = quantity * rates[currency][kind === "purchase" ? "buy" : "redeem"];
  if (!Number.isSafeInteger(amount) || amount > 1_000_000_000)
    throw new BadRequestException("Amount exceeds the wallet limit.");
  if (kind === "withdrawal" && amount < minimum)
    throw new BadRequestException("Withdrawal is below the configured minimum.");
  return amount;
}
export function nextWalletStatus(
  kind: "purchase" | "withdrawal",
  status: WalletStatus,
  action: "verify" | "approve" | "reject" | "paid",
): WalletStatus {
  if (kind === "purchase" && status === "submitted" && action === "verify") return "verified";
  if (
    kind === "purchase" &&
    (status === "pending" || status === "submitted") &&
    action === "reject"
  )
    return "rejected";
  if (kind === "withdrawal" && status === "pending" && action === "approve") return "approved";
  if (
    kind === "withdrawal" &&
    (status === "pending" || status === "approved") &&
    action === "reject"
  )
    return "rejected";
  if (kind === "withdrawal" && status === "approved" && action === "paid") return "paid";
  throw new ConflictException(
    "This request has already been decided or is not ready for that action. Refresh the queue.",
  );
}
