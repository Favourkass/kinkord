import { describe, it, expect } from "vitest";
import { walletBankVM, walletMoney, walletOperationVM, type WalletOperationPM } from "./wallet";
describe("wallet display models", () => {
  it("formats integer kobo as NGN rather than dollars", () => {
    expect(walletMoney(123456)).toContain("1,234.56");
    expect(walletMoney(123456)).toContain("₦");
  });
  it("masks account numbers and preserves the default flag", () => {
    expect(
      walletBankVM({
        id: "b",
        userId: "u",
        bankName: "Test",
        accountName: "Member",
        accountNumber: "0123456789",
        isDefault: 1,
        createdAt: "2026-10-07",
      }),
    ).toMatchObject({ maskedNumber: "•••• 6789", default: true });
  });
  it("distinguishes an approved request from an actual payout", () => {
    const row = {
      amountKobo: 80000,
      quantity: 100,
      accountNumber: "0123456789",
      createdAt: "2026-10-07T10:00:00Z",
      status: "approved",
    } as WalletOperationPM;
    expect(walletOperationVM(row).statusLabel).toBe("Approved · awaiting transfer");
    expect(walletOperationVM({ ...row, status: "paid" }).statusLabel).toBe("Paid");
  });
});
