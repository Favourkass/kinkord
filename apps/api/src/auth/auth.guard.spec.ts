import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { type PresenceService } from "../presence/presence.service";
import { AuthGuard } from "./auth.guard";
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
    const guard = new AuthGuard(authWith(null), presence);
    await expect(guard.canActivate(ctxFor({ headers: {} }))).rejects.toThrow(UnauthorizedException);
    expect(touch).not.toHaveBeenCalled();
  });

  it("attaches user and session to the request and touches presence when signed in", async () => {
    const session = { user: { id: "u1", email: "a@b.c" }, session: { id: "s1" } };
    const { presence, touch } = presenceStub();
    const guard = new AuthGuard(authWith(session), presence);
    const req: Record<string, unknown> = { headers: { cookie: "x" } };
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.user).toEqual(session.user);
    expect(req.session).toEqual(session.session);
    expect(touch).toHaveBeenCalledWith("u1");
  });
});
