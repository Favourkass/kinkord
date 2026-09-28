import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AdminGuard } from "./admin.guard";

function contextFor(user?: object) {
  const req = { user };
  return { switchToHttp: () => ({ getRequest: () => req }) } as never;
}

function dbAnswering(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result);
  return {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) })),
  } as never;
}

describe("AdminGuard", () => {
  it("lets the super admin through", async () => {
    const guard = new AdminGuard(dbAnswering([]));
    await expect(
      guard.canActivate(
        contextFor({ id: "u1", email: "maxihandsome@gmail.com", emailVerified: true }),
      ),
    ).resolves.toBe(true);
  });

  it("lets a staff member through", async () => {
    const guard = new AdminGuard(dbAnswering([{ userId: "u2" }]));
    await expect(
      guard.canActivate(contextFor({ id: "u2", email: "mod@kinkord.test", emailVerified: true })),
    ).resolves.toBe(true);
  });

  it("refuses an ordinary member", async () => {
    const guard = new AdminGuard(dbAnswering([]));
    await expect(
      guard.canActivate(
        contextFor({ id: "u3", email: "member@kinkord.test", emailVerified: true }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses when nobody is signed in", async () => {
    const guard = new AdminGuard(dbAnswering([]));
    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(ForbiddenException);
  });
});
