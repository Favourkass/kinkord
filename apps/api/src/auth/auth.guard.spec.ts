import { afterEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type PresenceService } from "../presence/presence.service";
import {
  AllowDuringSignUp,
  AuthGuard,
  PHONE_VERIFICATION_REQUIRED,
  PROFILE_PHOTOS_REQUIRED,
} from "./auth.guard";
import { type Auth } from "./auth.instance";

// The phone step is optional for now; most tests here turn it back on to check
// the hold that returns with it.
const phoneStep = vi.hoisted(() => ({ required: true }));
vi.mock("../profiles/phone-rules", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../profiles/phone-rules")>()),
  get PHONE_STEP_REQUIRED() {
    return phoneStep.required;
  },
}));

class Routes {
  finishSignUp() {}
  feed() {}
}
// Applied by hand: the spec transform doesn't compile decorator syntax.
AllowDuringSignUp()(
  Routes.prototype,
  "finishSignUp",
  Object.getOwnPropertyDescriptor(Routes.prototype, "finishSignUp")!,
);

const ctx = (req: object, handler: keyof Routes = "feed") =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
  }) as never;

const authWith = (session: unknown) =>
  ({ api: { getSession: vi.fn(async () => session) } }) as unknown as Auth;

const presenceStub = () => {
  const touch = vi.fn();
  return { presence: { touch } as unknown as PresenceService, touch };
};

interface ProfileRow {
  phoneVerified: boolean;
  avatarKey: string | null;
  coverKey: string | null;
}
const finished: ProfileRow = {
  phoneVerified: true,
  avatarKey: "avatars/u1/a.jpg",
  coverKey: "covers/u1/c.jpg",
};

/** `null` is an account with no profile row at all. */
const dbWithProfile = (row: Partial<ProfileRow> | null) => {
  const limit = vi.fn().mockResolvedValue(row === null ? [] : [{ ...finished, ...row }]);
  return { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) })) };
};

const guardWithDb = (createdAt: string, db: ReturnType<typeof dbWithProfile>) =>
  new AuthGuard(
    authWith({ user: { id: "u1", createdAt }, session: { id: "s1" } }),
    presenceStub().presence,
    new Reflector(),
    db as never,
  );

const guardFor = (createdAt: string, row: Partial<ProfileRow> | null) =>
  guardWithDb(createdAt, dbWithProfile(row));

const holdOf = async (guard: AuthGuard, handler: keyof Routes = "feed") => {
  const err = await guard.canActivate(ctx({ headers: {} }, handler)).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ForbiddenException);
  return ((err as ForbiddenException).getResponse() as { code: string }).code;
};

const NEW = "2026-09-28T10:00:00Z";
const OLD = "2026-09-01T10:00:00Z";

describe("AuthGuard", () => {
  it("rejects requests without a session and records no heartbeat", async () => {
    const { presence, touch } = presenceStub();
    const guard = new AuthGuard(authWith(null), presence, new Reflector(), {} as never);
    await expect(guard.canActivate(ctx({ headers: {} }))).rejects.toThrow(UnauthorizedException);
    expect(touch).not.toHaveBeenCalled();
  });

  it("attaches user and session to the request and touches presence when signed in", async () => {
    const session = { user: { id: "u1", email: "a@b.c" }, session: { id: "s1" } };
    const { presence, touch } = presenceStub();
    const guard = new AuthGuard(
      authWith(session),
      presence,
      new Reflector(),
      dbWithProfile({}) as never,
    );
    const req: Record<string, unknown> = { headers: { cookie: "x" } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toEqual(session.user);
    expect(req.session).toEqual(session.session);
    expect(touch).toHaveBeenCalledWith("u1");
  });
});

describe("AuthGuard phone requirement", () => {
  it("holds a new account without a verified phone at the phone step", async () => {
    expect(await holdOf(guardFor(NEW, { phoneVerified: false }))).toBe(PHONE_VERIFICATION_REQUIRED);
  });

  it("lets that account reach the routes it needs to finish sign-up", async () => {
    await expect(
      guardFor(NEW, { phoneVerified: false }).canActivate(ctx({ headers: {} }, "finishSignUp")),
    ).resolves.toBe(true);
  });

  it("lets a new account through once the phone is verified", async () => {
    await expect(guardFor(NEW, {}).canActivate(ctx({ headers: {} }))).resolves.toBe(true);
  });

  it("leaves accounts from before the rule alone", async () => {
    await expect(
      guardFor(OLD, { phoneVerified: false }).canActivate(ctx({ headers: {} })),
    ).resolves.toBe(true);
  });

  it("asks for the phone before the photos, in sign-up order", async () => {
    expect(
      await holdOf(guardFor(NEW, { phoneVerified: false, avatarKey: null, coverKey: null })),
    ).toBe(PHONE_VERIFICATION_REQUIRED);
  });

  describe("while the phone step is optional", () => {
    afterEach(() => {
      phoneStep.required = true;
    });

    it("lets a new account in without a verified phone", async () => {
      phoneStep.required = false;
      await expect(
        guardFor(NEW, { phoneVerified: false }).canActivate(ctx({ headers: {} })),
      ).resolves.toBe(true);
    });

    it("still asks that account for its photos", async () => {
      phoneStep.required = false;
      expect(await holdOf(guardFor(NEW, { phoneVerified: false, avatarKey: null }))).toBe(
        PROFILE_PHOTOS_REQUIRED,
      );
    });
  });
});

describe("AuthGuard profile photos", () => {
  it("holds a member without a profile photo at the photo step", async () => {
    expect(await holdOf(guardFor(NEW, { avatarKey: null }))).toBe(PROFILE_PHOTOS_REQUIRED);
  });

  it("holds a member without a cover picture too", async () => {
    expect(await holdOf(guardFor(NEW, { coverKey: null }))).toBe(PROFILE_PHOTOS_REQUIRED);
  });

  it("applies to accounts from before the phone rule as well", async () => {
    expect(await holdOf(guardFor(OLD, { avatarKey: null, coverKey: null }))).toBe(
      PROFILE_PHOTOS_REQUIRED,
    );
  });

  it("lets that member reach the routes they need to add photos, without a lookup", async () => {
    const db = dbWithProfile({ avatarKey: null });
    await expect(
      guardWithDb(OLD, db).canActivate(ctx({ headers: {} }, "finishSignUp")),
    ).resolves.toBe(true);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("doesn't lock out an account with no profile to add photos to", async () => {
    await expect(guardFor(OLD, null).canActivate(ctx({ headers: {} }))).resolves.toBe(true);
  });
});
