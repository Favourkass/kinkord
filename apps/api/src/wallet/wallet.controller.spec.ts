import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { WalletGiftsService } from "./wallet-gifts.service";
import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { AdminWalletController, WalletController } from "./wallet.controller";
import type { WalletService } from "./wallet.service";
import type { AuthedRequest } from "../auth/auth.guard";
describe("wallet boundaries", () => {
  it("requires member auth and staff auth on every admin wallet endpoint", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, WalletController)).toEqual([AuthGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminWalletController)).toEqual([
      AuthGuard,
      AdminGuard,
    ]);
  });
  it("scopes bank-account listing to the authenticated member", () => {
    const banks = vi.fn();
    new WalletController({ banks } as unknown as WalletService, {} as WalletGiftsService).banks({
      user: { id: "self" },
    } as AuthedRequest);
    expect(banks).toHaveBeenCalledWith("self");
  });
  it("refuses rate changes from an ordinary staff account before calling the service", () => {
    const saveSettings = vi.fn();
    const controller = new AdminWalletController({ saveSettings } as unknown as WalletService);
    expect(() =>
      controller.save(
        {
          user: { id: "staff", email: "staff@example.test", emailVerified: true },
        } as AuthedRequest,
        {},
      ),
    ).toThrow(/founders/);
    expect(saveSettings).not.toHaveBeenCalled();
  });
});

it("derives gift sender from the session and strips a forged recipient", () => {
  const send = vi.fn();
  const c = new WalletController({} as WalletService, { send } as unknown as WalletGiftsService);
  const input = {
    postId: "11111111-1111-4111-8111-111111111111",
    requestKey: "22222222-2222-4222-8222-222222222222",
    quantity: 2,
    currency: "coin",
  };
  c.gift({ user: { id: "sender" } } as AuthedRequest, { ...input, recipientId: "attacker" });
  expect(send).toHaveBeenCalledWith("sender", input);
});
