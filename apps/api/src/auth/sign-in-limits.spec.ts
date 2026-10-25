import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { type Db } from "../db/db.module";
import {
  accountFor,
  clearSignInFailures,
  countPasswordSignIn,
  guardPasswordSignIn,
  networkKey,
  recordSignInFailure,
  signInBlocked,
  TOO_MANY_ATTEMPTS,
} from "./sign-in-limits";

/** Answers the queries these helpers make, and records what they wrote. */
function fakeDb(
  answers: { counts?: Array<{ key: string; n: number }>; users?: Array<{ id: string }> } = {},
) {
  const calls: Array<{ op: "select" | "insert" | "delete"; arg: unknown }> = [];
  const db = {
    select: () => ({
      from: () => ({
        where: (clause: unknown) => {
          calls.push({ op: "select", arg: clause });
          return {
            groupBy: async () => answers.counts ?? [],
            limit: async () => answers.users ?? [],
          };
        },
      }),
    }),
    insert: () => ({
      values: async (rows: unknown) => {
        calls.push({ op: "insert", arg: rows });
      },
    }),
    delete: () => ({
      where: async (clause: unknown) => {
        calls.push({ op: "delete", arg: clause });
      },
    }),
  };
  return { db: db as unknown as Db, calls };
}

const query = (clause: unknown) => new PgDialect().sqlToQuery(clause as SQL);
const fromNetwork = (ip: string) => new Headers({ "x-forwarded-for": ip });

beforeEach(() => vi.stubEnv("AUTH_SECRET", "test-secret"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("networkKey", () => {
  it("keeps a keyed hash of the address, never the address itself", () => {
    const key = networkKey("102.89.4.7");
    expect(key).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(key).not.toContain("102.89.4.7");
    expect(networkKey("102.89.4.7")).toBe(key);
    expect(networkKey("102.89.4.8")).not.toBe(key);
  });

  it("has nothing to count without an address or a secret", () => {
    expect(networkKey(null)).toBeNull();
    vi.stubEnv("AUTH_SECRET", "");
    expect(networkKey("102.89.4.7")).toBeNull();
  });
});

describe("signInBlocked", () => {
  it("asks nothing when there's no account or network to count", async () => {
    const { db, calls } = fakeDb();
    expect(await signInBlocked(db, { account: null, network: null })).toBe(false);
    expect(calls).toEqual([]);
  });

  it("allows four wrong passwords on an account and stops at the fifth", async () => {
    const keys = { account: "user:u1", network: null };
    expect(await signInBlocked(fakeDb({ counts: [{ key: "user:u1", n: 4 }] }).db, keys)).toBe(
      false,
    );
    expect(await signInBlocked(fakeDb({ counts: [{ key: "user:u1", n: 5 }] }).db, keys)).toBe(true);
  });

  it("gives a shared network far more room before it stops", async () => {
    const keys = { account: "user:u1", network: "ip:abc" };
    expect(await signInBlocked(fakeDb({ counts: [{ key: "ip:abc", n: 49 }] }).db, keys)).toBe(
      false,
    );
    expect(await signInBlocked(fakeDb({ counts: [{ key: "ip:abc", n: 50 }] }).db, keys)).toBe(true);
  });

  it("only counts the last 15 minutes, for the keys asked about", async () => {
    const { db, calls } = fakeDb();
    await signInBlocked(db, { account: "user:u1", network: "ip:abc" });
    const where = query(calls[0].arg);
    expect(where.sql).toContain("now() - interval '15 minutes'");
    expect(where.params).toEqual(["user:u1", "ip:abc"]);
  });
});

describe("recording and clearing", () => {
  it("records a wrong password against the account and the network", async () => {
    const { db, calls } = fakeDb();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    await recordSignInFailure(db, { account: "user:u1", network: "ip:abc" });
    expect(calls).toEqual([{ op: "insert", arg: [{ key: "user:u1" }, { key: "ip:abc" }] }]);
  });

  it("writes nothing when there's nothing to count", async () => {
    const { db, calls } = fakeDb();
    await recordSignInFailure(db, { account: null, network: null });
    expect(calls).toEqual([]);
  });

  it("now and then clears rows older than a day", async () => {
    const { db, calls } = fakeDb();
    vi.spyOn(Math, "random").mockReturnValue(0);
    await recordSignInFailure(db, { account: "user:u1", network: null });
    expect(calls.map((c) => c.op)).toEqual(["insert", "delete"]);
    expect(query(calls[1].arg).sql).toContain("now() - interval '1 day'");
  });

  it("clears only the account's count after the right password", async () => {
    const { db, calls } = fakeDb();
    await clearSignInFailures(db, "user:u1");
    expect(calls).toHaveLength(1);
    expect(query(calls[0].arg).params).toEqual(["user:u1"]);
    const none = fakeDb();
    await clearSignInFailures(none.db, null);
    expect(none.calls).toEqual([]);
  });
});

describe("accountFor", () => {
  it("finds the account by email or username the way Better Auth stores them", async () => {
    const byEmail = fakeDb({ users: [{ id: "u1" }] });
    expect(await accountFor(byEmail.db, "/sign-in/email", { email: "  Tega@Example.COM " })).toBe(
      "user:u1",
    );
    expect(query(byEmail.calls[0].arg).params).toEqual(["tega@example.com"]);
    const byName = fakeDb({ users: [{ id: "u2" }] });
    expect(await accountFor(byName.db, "/sign-in/username", { username: "MaxiHandsome" })).toBe(
      "user:u2",
    );
    expect(query(byName.calls[0].arg).params).toEqual(["maxihandsome"]);
  });

  it("names no account for an unknown one, another route or a malformed body", async () => {
    expect(
      await accountFor(fakeDb().db, "/sign-in/email", { email: "nobody@example.com" }),
    ).toBeNull();
    const other = fakeDb({ users: [{ id: "u1" }] });
    expect(await accountFor(other.db, "/sign-up/email", { email: "a@b.c" })).toBeNull();
    expect(await accountFor(other.db, "/sign-in/email", { email: 42 })).toBeNull();
    expect(other.calls).toEqual([]);
  });
});

describe("the Better Auth hooks", () => {
  const signIn = (returned?: unknown) => ({
    path: "/sign-in/email",
    body: { email: "tega@example.com" },
    headers: fromNetwork("102.89.4.7"),
    context: { returned },
  });

  it("ignore every route that isn't a password sign-in", async () => {
    const { db, calls } = fakeDb();
    await guardPasswordSignIn(db, { ...signIn(), path: "/get-session" });
    await countPasswordSignIn(db, { ...signIn(), path: "/sign-out" });
    expect(calls).toEqual([]);
  });

  it("refuse a sign-in once the account is over its limit, with a clear message", async () => {
    const { db } = fakeDb({ users: [{ id: "u1" }], counts: [{ key: "user:u1", n: 5 }] });
    const refusal = await guardPasswordSignIn(db, signIn()).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(APIError);
    expect((refusal as APIError).statusCode).toBe(429);
    expect((refusal as APIError).message).toBe(TOO_MANY_ATTEMPTS);
  });

  it("count a wrong password against the account and its network", async () => {
    const { db, calls } = fakeDb({ users: [{ id: "u1" }] });
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    await countPasswordSignIn(db, signIn(new APIError("UNAUTHORIZED", { message: "Invalid" })));
    const insert = calls.find((c) => c.op === "insert");
    expect(insert?.arg).toEqual([{ key: "user:u1" }, { key: networkKey("102.89.4.7") }]);
  });

  it("clear the account after the right password, and leave other refusals alone", async () => {
    const ok = fakeDb({ users: [{ id: "u1" }] });
    await countPasswordSignIn(ok.db, signIn({ token: "t", user: { id: "u1" } }));
    expect(ok.calls.map((c) => c.op)).toEqual(["select", "delete"]);
    // A suspended member's right password is refused later; it isn't a guess.
    const banned = fakeDb({ users: [{ id: "u1" }] });
    await countPasswordSignIn(
      banned.db,
      signIn(new APIError("FORBIDDEN", { message: "Suspended" })),
    );
    expect(banned.calls.map((c) => c.op)).toEqual(["select"]);
  });
});
