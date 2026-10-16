export interface BankAccountPM {
  id: string;
  bank: string;
  holder: string;
  last4: string;
  type: "Savings" | "Current";
  isDefault: boolean;
}
export function bankAccountToVM(account: BankAccountPM) {
  return {
    ...account,
    maskedNumber: `•••• ${account.last4}`,
    detail: `•••• ${account.last4} · ${account.type}`,
  };
}
