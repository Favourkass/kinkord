import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { WalletGiftsService } from "./wallet-gifts.service";
import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { SUPER_ADMIN_EMAILS } from "../moderation/admins";
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
  it("says whose wallet the status is", async () => {
    const wallet = {
      settings: vi.fn(async () => ({})),
      balances: vi.fn(async () => []),
      redemptionEligibility: vi.fn(async () => ({ canRedeem: false, reason: null })),
    };
    const status = await new WalletController(
      wallet as unknown as WalletService,
      {} as WalletGiftsService,
    ).status({ user: { id: "self" } } as AuthedRequest);
    expect(status.userId).toBe("self");
    expect(wallet.balances).toHaveBeenCalledWith("self");
  });
  it("scopes bank-account listing to the authenticated member", () => {
    const banks = vi.fn();
    new WalletController({ banks } as unknown as WalletService, {} as WalletGiftsService).banks({
      user: { id: "self" },
    } as AuthedRequest);
    expect(banks).toHaveBeenCalledWith("self");
  });
  it("refuses coin credits and payouts from an ordinary staff account", () => {
    const decide = vi.fn();
    const controller = new AdminWalletController({ decide } as unknown as WalletService);
    expect(() =>
      controller.decide(
        {
          user: { id: "staff", email: "staff@example.test", emailVerified: true },
        } as AuthedRequest,
        "33333333-3333-4333-8333-333333333333",
        { action: "verify", bankReference: "REF123" },
      ),
    ).toThrow(/founders/);
    expect(decide).not.toHaveBeenCalled();
  });
  it("lets a founder credit coins and pay out", () => {
    const decide = vi.fn();
    const controller = new AdminWalletController({ decide } as unknown as WalletService);
    controller.decide(
      {
        user: { id: "founder", email: SUPER_ADMIN_EMAILS[0], emailVerified: true },
      } as AuthedRequest,
      "33333333-3333-4333-8333-333333333333",
      { action: "approve" },
    );
    expect(decide).toHaveBeenCalledWith("founder", "33333333-3333-4333-8333-333333333333", {
      action: "approve",
    });
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
