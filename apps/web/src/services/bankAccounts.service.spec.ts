// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import { bankAccountsService } from "./bankAccounts.service";
const stored = vi.hoisted(() => new Map());
vi.mock("@/repositories/bankAccounts.repository", () => ({
  bankAccountsRepository: {
    read: (user: string) => stored.get(user) ?? [],
    write: (user: string, accounts: unknown) => stored.set(user, accounts),
  },
}));
describe("bankAccountsService", () => {
  beforeEach(() => stored.clear());
  it("saves multiple masked accounts, switches the default and promotes a remaining account on removal", () => {
    const input = {
      bank: "Test Bank",
      holder: "Test User",
      number: "1234567890",
      type: "Savings" as const,
    };
    const first = bankAccountsService.add("test", input)[0];
    const accounts = bankAccountsService.add("test", {
      ...input,
      bank: "Second Bank",
      number: "0987654321",
    });
    expect(accounts).toHaveLength(2);
    expect(accounts[0].isDefault).toBe(true);
    expect(JSON.stringify(accounts)).not.toContain(input.number);
    expect(
      bankAccountsService
        .setDefault("test", accounts[1].id)
        .filter((a) => a.isDefault)
        .map((a) => a.bank),
    ).toEqual(["Second Bank"]);
    expect(bankAccountsService.remove("test", accounts[1].id)).toEqual([
      { ...first, isDefault: true },
    ]);
    expect(bankAccountsService.read("other")).toEqual([]);
  });
  it("rejects invalid details without saving an account", () => {
    expect(() =>
      bankAccountsService.add("test", {
        bank: "A",
        holder: "Test",
        number: "abc",
        type: "Savings",
      }),
    ).toThrow(/6–20 digits/);
    expect(bankAccountsService.read("test")).toEqual([]);
  });
});
