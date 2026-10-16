import { describe, it, expect } from "vitest";
import { bankAccountToVM } from "./bankAccount";
describe("bankAccountToVM", () => {
  it("formats the saved last four digits without retaining a full account number", () => {
    expect(
      bankAccountToVM({
        id: "a",
        bank: "Test Bank",
        holder: "Test User",
        last4: "1234",
        type: "Savings",
        isDefault: true,
      }),
    ).toMatchObject({ maskedNumber: "•••• 1234", detail: "•••• 1234 · Savings" });
  });
});
