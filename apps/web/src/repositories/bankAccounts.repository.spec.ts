// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from "vitest";
import { bankAccountsRepository } from "./bankAccounts.repository";
describe("bankAccountsRepository", () => {
  beforeEach(() => sessionStorage.clear());
  it("isolates preview data by member and handles malformed storage", () => {
    bankAccountsRepository.write("alice", [
      { id: "a", bank: "Test", holder: "Alice", last4: "1234", type: "Savings", isDefault: true },
    ]);
    expect(bankAccountsRepository.read("alice")).toHaveLength(1);
    expect(bankAccountsRepository.read("bob")).toEqual([]);
    sessionStorage.setItem("kinkord:bank-preview:alice", "bad json");
    expect(bankAccountsRepository.read("alice")).toEqual([]);
    expect(() => bankAccountsRepository.write("", [])).toThrow();
  });
});
