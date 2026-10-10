// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBankAccountsPresenter } from "./useBankAccountsPresenter";
const stored = vi.hoisted(() => new Map());
vi.mock("@/repositories/bankAccounts.repository", () => ({
  bankAccountsRepository: {
    read: (user: string) => stored.get(user) ?? [],
    write: (user: string, accounts: unknown) => stored.set(user, accounts),
  },
}));
describe("useBankAccountsPresenter", () => {
  beforeEach(() => stored.clear());
  it("clears the form after saving, reloads the saved account, and clears accounts when member changes", () => {
    const { result, rerender } = renderHook(({ user }) => useBankAccountsPresenter(user), {
      initialProps: { user: "test" },
    });
    act(() => {
      result.current.onChange("bank", "Test Bank");
      result.current.onChange("holder", "Test User");
      result.current.onChange("number", "1234567890");
    });
    act(() => result.current.onSave());
    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.form.number).toBe("");
    expect(result.current.status).toBe("Bank account saved.");
    rerender({ user: "other" });
    expect(result.current.accounts).toEqual([]);
    rerender({ user: "test" });
    expect(result.current.accounts).toHaveLength(1);
  });
});
