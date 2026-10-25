import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpException, UnauthorizedException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import { type Db } from "../db/db.module";
import { type Auth } from "./auth.instance";
import { PhoneSignInService } from "./phone-sign-in.service";
import {
  networkKey,
  recordSignInFailure,
  signInBlocked,
  TOO_MANY_ATTEMPTS,
} from "./sign-in-limits";

// The limits have their own tests; here, only how the phone route uses them.
vi.mock("./sign-in-limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sign-in-limits")>()),
  signInBlocked: vi.fn(async () => false),
  recordSignInFailure: vi.fn(async () => undefined),
}));
beforeEach(() => {
  vi.mocked(signInBlocked).mockClear().mockResolvedValue(false);
  vi.mocked(recordSignInFailure).mockClear();
  vi.stubEnv("AUTH_SECRET", "test-secret");
});

const makeService = (rows: Array<{ email: string }>) => {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn((_clause: unknown) => ({ limit }));
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin }));
  const select = vi.fn(() => ({ from }));
  const signInEmail = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  const db = { select } as unknown as Db;
  const auth = { api: { signInEmail } } as unknown as Auth;
  return { service: new PhoneSignInService(db, auth), signInEmail, where };
};

const input = { phone: "+2348035550142", password: "supersecret123", rememberMe: true };

describe("PhoneSignInService", () => {
  it("rejects unknown phone numbers with a generic message", async () => {
    const { service, signInEmail } = makeService([]);
    await expect(service.signInWithPhone(input, new Headers())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("only looks the number up among phones that were verified", async () => {
    // Anyone can type someone else's number into their profile; that copy must
    // neither sign in nor make the owner's own match ambiguous.
    const { service, where } = makeService([{ email: "tega@x.dev" }]);
    await service.signInWithPhone(input, new Headers());
    const lookup = new PgDialect().sqlToQuery(where.mock.calls[0][0] as never);
    expect(lookup.sql).toBe('("profile"."phone" = $1 and "profile"."phone_verified" = $2)');
    expect(lookup.params).toEqual(["+2348035550142", true]);
  });

  it("rejects ambiguous phone numbers shared by two accounts", async () => {
    const { service, signInEmail } = makeService([{ email: "a@x.dev" }, { email: "b@x.dev" }]);
    await expect(service.signInWithPhone(input, new Headers())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("counts a number that matches no account against the network", async () => {
    const { service } = makeService([]);
    const headers = new Headers({ "x-forwarded-for": "102.89.4.7" });
    await expect(service.signInWithPhone(input, headers)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(recordSignInFailure).toHaveBeenCalledWith(expect.anything(), {
      account: null,
      network: networkKey("102.89.4.7"),
    });
  });

  it("stops a network that has used up its wrong guesses before looking anything up", async () => {
    vi.mocked(signInBlocked).mockResolvedValue(true);
    const { service, signInEmail, where } = makeService([{ email: "tega@x.dev" }]);
    const refusal = await service.signInWithPhone(input, new Headers()).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(HttpException);
    expect((refusal as HttpException).getStatus()).toBe(429);
    expect((refusal as HttpException).message).toBe(TOO_MANY_ATTEMPTS);
    expect(where).not.toHaveBeenCalled();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("delegates a unique match to Better Auth email sign-in", async () => {
    const { service, signInEmail } = makeService([{ email: "tega@x.dev" }]);
    const headers = new Headers({ origin: "http://localhost:3100" });
    const response = await service.signInWithPhone(input, headers);
    expect(response.status).toBe(200);
    expect(signInEmail).toHaveBeenCalledWith({
      body: { email: "tega@x.dev", password: "supersecret123", rememberMe: true },
      headers,
      asResponse: true,
    });
  });
});
