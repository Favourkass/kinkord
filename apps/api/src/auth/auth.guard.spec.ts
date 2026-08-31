import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { type Auth } from "./auth.instance";

const ctxFor = (req: object) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as never;

const authWith = (session: unknown) =>
  ({ api: { getSession: vi.fn(async () => session) } }) as unknown as Auth;

describe("AuthGuard", () => {
  it("rejects requests without a session", async () => {
    const guard = new AuthGuard(authWith(null));
    await expect(guard.canActivate(ctxFor({ headers: {} }))).rejects.toThrow(UnauthorizedException);
  });

  it("attaches user and session to the request when signed in", async () => {
    const session = { user: { id: "u1", email: "a@b.c" }, session: { id: "s1" } };
    const guard = new AuthGuard(authWith(session));
    const req: Record<string, unknown> = { headers: { cookie: "x" } };
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.user).toEqual(session.user);
    expect(req.session).toEqual(session.session);
  });
});
