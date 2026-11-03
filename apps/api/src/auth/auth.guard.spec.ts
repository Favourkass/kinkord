import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EmailVerificationController } from "../otp/otp.controller";
import { type PresenceService } from "../presence/presence.service";
import { ProfilesController } from "../profiles/profiles.controller";
import { PushController } from "../push/push.controller";
import { type LocationCheckService } from "../location-check/location-check.service";
import {
  AllowDuringSignUp,
  AuthGuard,
  EMAIL_VERIFICATION_REQUIRED,
  EMAIL_VERIFICATION_REQUIRED_FROM,
  LOCATION_CHECK_REQUIRED,
  PROFILE_PHOTOS_REQUIRED,
  needsEmailVerification,
} from "./auth.guard";
import { type Auth } from "./auth.instance";
import { MeController } from "./me.controller";

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

const ctxFor = (req: object, handler: unknown, cls: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => cls,
  }) as never;

const ctx = (req: object, handler: keyof Routes = "feed") =>
  ctxFor(req, Routes.prototype[handler], Routes);

const authWith = (session: unknown) =>
  ({ api: { getSession: vi.fn(async () => session) } }) as unknown as Auth;

const presenceStub = () => {
  const touch = vi.fn();
  return { presence: { touch } as unknown as PresenceService, touch };
};

/** Whether the member owes a country check; the rules themselves are LocationCheckService's. */
const locationStub = (owes = false) => {
  const checkDue = vi.fn(async () => ({ due: owes, hold: owes }));
  return { location: { checkDue } as unknown as LocationCheckService, checkDue };
};

interface ProfileRow {
  signupPhotosSkipped: boolean;
  photoSkipAvailable: boolean;
  avatarKey: string | null;
  coverKey: string | null;
  country: string | null;
  accountType: "person" | "organization";
}
const finished: ProfileRow = {
  signupPhotosSkipped: false,
  photoSkipAvailable: false,
  avatarKey: "avatars/u1/a.jpg",
  coverKey: "covers/u1/c.jpg",
  country: "NG",
  accountType: "person",
};

/** `null` is an account with no profile row at all. */
const dbWithProfile = (row: Partial<ProfileRow> | null) => {
  const limit = vi.fn().mockResolvedValue(row === null ? [] : [{ ...finished, ...row }]);
  // The profile row comes with the member's country-check standing joined on.
  return {
    select: vi.fn(() => ({ from: () => ({ leftJoin: () => ({ where: () => ({ limit }) }) }) })),
  };
};

interface Account {
  createdAt: string;
  emailVerified?: boolean;
  email?: string;
}

const guardWithDb = (
  account: Account | string,
  db: ReturnType<typeof dbWithProfile>,
  location = locationStub().location,
) => {
  const {
    createdAt,
    emailVerified = true,
    email = "member@kinkord.com",
  } = typeof account === "string" ? { createdAt: account } : account;
  return new AuthGuard(
    authWith({
      user: { id: "u1", email, emailVerified, createdAt },
      session: { id: "s1", createdAt: "2026-11-02T08:00:00Z" },
    }),
    presenceStub().presence,
    new Reflector(),
    db as never,
    location,
  );
};

const guardFor = (account: Account | string, row: Partial<ProfileRow> | null) =>
  guardWithDb(account, dbWithProfile(row));

const holdOf = async (guard: AuthGuard, handler: keyof Routes = "feed") => {
  const err = await guard.canActivate(ctx({ headers: {} }, handler)).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ForbiddenException);
  return ((err as ForbiddenException).getResponse() as { code: string }).code;
};

const NEW = "2026-10-14T10:00:00Z";
const OLD = "2026-09-01T10:00:00Z";

describe("AuthGuard", () => {
  it("rejects requests without a session and records no heartbeat", async () => {
    const { presence, touch } = presenceStub();
    const guard = new AuthGuard(
      authWith(null),
      presence,
      new Reflector(),
      {} as never,
      locationStub().location,
    );
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
      locationStub().location,
    );
    const req: Record<string, unknown> = { headers: { cookie: "x" } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toEqual(session.user);
    expect(req.session).toEqual(session.session);
    expect(touch).toHaveBeenCalledWith("u1");
  });
});

describe("AuthGuard email verification", () => {
  const unverified = { createdAt: NEW, emailVerified: false };

  it("holds a new account without a verified email at the email step, without a lookup", async () => {
    const db = dbWithProfile({});
    expect(await holdOf(guardWithDb(unverified, db))).toBe(EMAIL_VERIFICATION_REQUIRED);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("starts with accounts created at the cut-off", async () => {
    expect(EMAIL_VERIFICATION_REQUIRED_FROM.toISOString()).toBe("2026-10-14T00:00:00.000Z");
    const atCutOff = { createdAt: "2026-10-14T00:00:00Z", emailVerified: false };
    expect(await holdOf(guardFor(atCutOff, {}))).toBe(EMAIL_VERIFICATION_REQUIRED);
  });

  it("leaves accounts from before the cut-off alone", async () => {
    await expect(
      guardFor({ createdAt: OLD, emailVerified: false }, {}).canActivate(ctx({ headers: {} })),
    ).resolves.toBe(true);
  });

  it("lets a new account through once the email is verified", async () => {
    await expect(
      guardFor({ createdAt: NEW, emailVerified: true }, {}).canActivate(ctx({ headers: {} })),
    ).resolves.toBe(true);
  });

  it("asks for the email before the photos, in sign-up order", async () => {
    expect(await holdOf(guardFor(unverified, { avatarKey: null, coverKey: null }))).toBe(
      EMAIL_VERIFICATION_REQUIRED,
    );
  });

  it("lets that account reach the routes marked for sign-up", async () => {
    await expect(
      guardFor(unverified, {}).canActivate(ctx({ headers: {} }, "finishSignUp")),
    ).resolves.toBe(true);
  });

  it.each([
    ["GET /me", MeController, MeController.prototype.me],
    [
      "POST /profile/email/send-code",
      EmailVerificationController,
      EmailVerificationController.prototype.sendCode,
    ],
    [
      "POST /profile/email/verify",
      EmailVerificationController,
      EmailVerificationController.prototype.verify,
    ],
    ["GET /profile", ProfilesController, ProfilesController.prototype.getOwn],
    ["GET /profile/options", ProfilesController, ProfilesController.prototype.options],
    ["PATCH /profile", ProfilesController, ProfilesController.prototype.update],
    ["POST /push/subscriptions/remove", PushController, PushController.prototype.unsubscribe],
  ])("keeps %s reachable while the email is unverified", async (_route, cls, handler) => {
    await expect(
      guardFor(unverified, {}).canActivate(ctxFor({ headers: {} }, handler, cls)),
    ).resolves.toBe(true);
  });

  it("never holds a founder", () => {
    const founder = { email: "maxihandsome@gmail.com", emailVerified: true, createdAt: NEW };
    expect(needsEmailVerification(founder)).toBe(false);
    // The founder list only counts a verified address, so the same address
    // unverified is just a new account like any other.
    expect(needsEmailVerification({ ...founder, emailVerified: false })).toBe(true);
  });

  it("doesn't hold an account whose creation date can't be read", () => {
    expect(
      needsEmailVerification({ email: "a@b.c", emailVerified: false, createdAt: "not a date" }),
    ).toBe(false);
  });
});

describe("AuthGuard profile photos", () => {
  const skipped = { avatarKey: null, coverKey: null, signupPhotosSkipped: true };

  it("allows access after the member skips photos at first sign-up", async () => {
    await expect(
      guardFor(NEW, { ...skipped, photoSkipAvailable: true }).canActivate(ctx({ headers: {} })),
    ).resolves.toBe(true);
  });

  it("keeps a skipped cover optional once the member adds a profile photo", async () => {
    await expect(
      guardFor(NEW, {
        ...skipped,
        avatarKey: "avatars/u1/a.jpg",
        photoSkipAvailable: false,
      }).canActivate(ctx({ headers: {} })),
    ).resolves.toBe(true);
  });

  it("asks a member who skipped, then had a photo and deleted it, for a new one", async () => {
    expect(await holdOf(guardFor(NEW, { ...skipped, photoSkipAvailable: false }))).toBe(
      PROFILE_PHOTOS_REQUIRED,
    );
  });

  it("holds a member without a profile photo at the photo step", async () => {
    expect(await holdOf(guardFor(NEW, { avatarKey: null }))).toBe(PROFILE_PHOTOS_REQUIRED);
  });

  it("holds a member without a cover picture too", async () => {
    expect(await holdOf(guardFor(NEW, { coverKey: null }))).toBe(PROFILE_PHOTOS_REQUIRED);
  });

  it("applies to accounts from before the email rule as well", async () => {
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

describe("AuthGuard location check", () => {
  it("holds a member who owes a country check at the location check", async () => {
    const { location, checkDue } = locationStub(true);
    const guard = guardWithDb(OLD, dbWithProfile({}), location);
    expect(await holdOf(guard)).toBe(LOCATION_CHECK_REQUIRED);
    expect(checkDue).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: "u1" }),
        sessionCreatedAt: new Date("2026-11-02T08:00:00Z"),
        profile: { country: "NG", accountType: "person" },
        standing: null,
      }),
    );
  });

  it("lets a member through once they have checked", async () => {
    const guard = guardWithDb(OLD, dbWithProfile({}), locationStub(false).location);
    await expect(guard.canActivate(ctx({ headers: {} }))).resolves.toBe(true);
  });

  it("asks for photos before the country, in sign-up order", async () => {
    const { location, checkDue } = locationStub(true);
    const guard = guardWithDb(OLD, dbWithProfile({ avatarKey: null }), location);
    expect(await holdOf(guard)).toBe(PROFILE_PHOTOS_REQUIRED);
    expect(checkDue).not.toHaveBeenCalled();
  });

  it("lets a held member reach the routes they need, without asking", async () => {
    const { location, checkDue } = locationStub(true);
    const guard = guardWithDb(OLD, dbWithProfile({}), location);
    await expect(guard.canActivate(ctx({ headers: {} }, "finishSignUp"))).resolves.toBe(true);
    expect(checkDue).not.toHaveBeenCalled();
  });

  it("doesn't hold an account with no profile, which has no country to check", async () => {
    const { location, checkDue } = locationStub(true);
    const guard = guardWithDb(OLD, dbWithProfile(null), location);
    await expect(guard.canActivate(ctx({ headers: {} }))).resolves.toBe(true);
    expect(checkDue).not.toHaveBeenCalled();
  });
});
