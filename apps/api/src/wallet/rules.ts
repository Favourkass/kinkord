import { BadRequestException, ConflictException } from "@nestjs/common";
import type { WalletCurrency, WalletRates, WalletStatus } from "../db/schema/wallet";
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
