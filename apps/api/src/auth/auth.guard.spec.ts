import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type PresenceService } from "../presence/presence.service";
import { AllowUnverifiedPhone, AuthGuard, PHONE_VERIFICATION_REQUIRED } from "./auth.guard";
import { type Auth } from "./auth.instance";

const ctxFor = (req: object) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as never;

const authWith = (session: unknown) =>
  ({ api: { getSession: vi.fn(async () => session) } }) as unknown as Auth;

const presenceStub = () => {
  const touch = vi.fn();
  return { presence: { touch } as unknown as PresenceService, touch };
};

describe("AuthGuard", () => {
  it("rejects requests without a session and records no heartbeat", async () => {
    const { presence, touch } = presenceStub();
    const guard = new AuthGuard(authWith(null), presence, new Reflector(), {} as never);
    await expect(guard.canActivate(ctxFor({ headers: {} }))).rejects.toThrow(UnauthorizedException);
    expect(touch).not.toHaveBeenCalled();
  });

  it("attaches user and session to the request and touches presence when signed in", async () => {
    const session = { user: { id: "u1", email: "a@b.c" }, session: { id: "s1" } };
    const { presence, touch } = presenceStub();
    const guard = new AuthGuard(authWith(session), presence, new Reflector(), {} as never);
    const req: Record<string, unknown> = { headers: { cookie: "x" } };
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.user).toEqual(session.user);
    expect(req.session).toEqual(session.session);
    expect(touch).toHaveBeenCalledWith("u1");
  });
});

describe("AuthGuard phone requirement", () => {
  class Routes {
    verifyPhone() {}
    feed() {}
  }
  // Applied by hand: the spec transform doesn't compile decorator syntax.
  AllowUnverifiedPhone()(
    Routes.prototype,
    "verifyPhone",
    Object.getOwnPropertyDescriptor(Routes.prototype, "verifyPhone")!,
  );
  const ctx = (req: object, handler: keyof Routes) =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => Routes.prototype[handler],
      getClass: () => Routes,
    }) as never;
  const dbWithPhone = (verified: boolean | null) => {
    const limit = vi.fn().mockResolvedValue(verified === null ? [] : [{ verified }]);
    return { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) })) } as never;
  };
  const guardFor = (createdAt: string, verified: boolean | null) =>
    new AuthGuard(
      authWith({ user: { id: "u1", createdAt }, session: { id: "s1" } }),
      presenceStub().presence,
      new Reflector(),
      dbWithPhone(verified),
    );

  it("holds a new account without a verified phone at the phone step", async () => {
    const err = await guardFor("2026-09-28T10:00:00Z", false)
      .canActivate(ctx({ headers: {} }, "feed"))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: PHONE_VERIFICATION_REQUIRED,
    });
  });

  it("lets that account reach the routes it needs to verify", async () => {
    await expect(
      guardFor("2026-09-28T10:00:00Z", false).canActivate(ctx({ headers: {} }, "verifyPhone")),
    ).resolves.toBe(true);
  });

  it("lets a new account through once the phone is verified", async () => {
    await expect(
      guardFor("2026-09-28T10:00:00Z", true).canActivate(ctx({ headers: {} }, "feed")),
    ).resolves.toBe(true);
  });

  it("leaves accounts from before the rule alone", async () => {
    await expect(
      guardFor("2026-09-01T10:00:00Z", false).canActivate(ctx({ headers: {} }, "feed")),
    ).resolves.toBe(true);
  });
});
