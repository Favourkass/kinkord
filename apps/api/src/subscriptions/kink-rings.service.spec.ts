import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { kinkRing, memberSubscription } from "../db/schema";
import type { PushService } from "../push/push.service";
import { KinkRingsService, giveRingSchema } from "./kink-rings.service";

/**
 * Each `await` takes the next queued answer; `transaction(fn)` runs `fn` on the
 * same stub, so a transaction's queries queue in line with the rest.
 */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        if (prop === "transaction") return (fn: (tx: unknown) => unknown) => fn(db);
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  const db = chain();
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = calls.findIndex((c) => c.op === anchor && c.args[0] === table);
    return start < 0 ? undefined : calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: db as never, calls, after, left: () => queue.length };
}

const render = (s: unknown) => new PgDialect().sqlToQuery(s as SQL);
const now = new Date("2026-10-27T12:00:00.000Z");
const RING = "0f1c8b1e-1111-4111-8111-000000000001";

function make(answers: unknown[]) {
  const q = queuedDb(answers);
  const push = { kinkRingGiven: vi.fn() };
  return { ...q, push, service: new KinkRingsService(q.db, push as unknown as PushService) };
}

const ada = { id: "ada", username: "ada", displayName: "Ada", accountType: "personal" };

describe("KinkRingsService.mine", () => {
  it("lists the rings left to give, soonest to expire first, and the last ones given", async () => {
    const { service, calls } = make([
      [
        { id: "r1", expiresAt: new Date("2026-11-26T12:00:00.000Z") },
        { id: "r2", expiresAt: new Date("2026-12-26T12:00:00.000Z") },
      ],
      [
        { id: "r0", givenAt: now, username: "ada", displayName: "Ada" },
        { id: "rx", givenAt: now, username: null, displayName: null },
      ],
    ]);
    await expect(service.mine("me", now)).resolves.toEqual({
      available: [
        { id: "r1", expiresAt: "2026-11-26T12:00:00.000Z" },
        { id: "r2", expiresAt: "2026-12-26T12:00:00.000Z" },
      ],
      given: [
        { id: "r0", givenAt: now.toISOString(), to: { username: "ada", displayName: "Ada" } },
        // Given to a member who has since left.
        { id: "rx", givenAt: now.toISOString(), to: null },
      ],
    });
    const unspent = render(calls.filter((c) => c.op === "where")[0].args[0]);
    expect(unspent.sql).toContain('"kink_ring"."owner_id" = $1');
    expect(unspent.sql).toContain('"kink_ring"."given_at" is null');
    expect(unspent.sql).toContain('"kink_ring"."expires_at" > $');
    expect(unspent.params).toEqual(["me", now.toISOString()]);
  });
});

describe("KinkRingsService.give", () => {
  it("gives the soonest-expiring ring: a month of Silver for them, and says so", async () => {
    const { service, after, calls, push, left } = make([
      [ada], // the receiver
      [], // no Silver of theirs yet
      [{ id: RING }], // the ring, locked
      undefined, // marked given
      [], // their subscription, locked
      undefined, // Silver for a month
      [{ n: 2 }], // left to give
    ]);
    await expect(service.give("me", "@Ada", now)).resolves.toEqual({
      ringId: RING,
      to: { username: "ada", displayName: "Ada" },
      left: 2,
    });
    // Usernames are stored lowercase.
    const lookup = render(calls.filter((c) => c.op === "where")[0].args[0]);
    expect(lookup.params).toContain("ada");
    expect(lookup.sql).toContain('"member_block"');
    expect(lookup.sql).toContain('"member_ban"');
    // The soonest to expire, locked so two gifts at once never spend the same ring.
    expect(calls.find((c) => c.op === "for")?.args).toEqual(["update", { skipLocked: true }]);
    expect(after("update", kinkRing, "set")).toEqual({ givenTo: "ada", givenAt: now });
    expect(after("insert", memberSubscription, "values")).toEqual({
      userId: "ada",
      plan: "silver",
      currentPeriodEnd: new Date("2026-11-27T12:00:00.000Z"),
      startedAt: now,
    });
    expect(push.kinkRingGiven).toHaveBeenCalledWith("me", "ada", RING);
    expect(left()).toBe(0);
  });

  it("is a 404 for a username nobody has, or someone blocked or suspended", async () => {
    const { service } = make([[]]);
    await expect(service.give("me", "nobody", now)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("won't give to the member themselves, nor to an organization", async () => {
    const self = make([[{ ...ada, id: "me" }]]);
    await expect(self.service.give("me", "ada", now)).rejects.toBeInstanceOf(BadRequestException);
    const org = make([[{ ...ada, accountType: "organization" }]]);
    await expect(org.service.give("me", "ada", now)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("won't spend a ring on someone whose Silver already runs for good", async () => {
    const { service, push } = make([[ada], [{ end: new Date("2099-12-31T12:00:00.000Z") }]]);
    await expect(service.give("me", "ada", now)).rejects.toThrow(
      "Ada already has Silver for good.",
    );
    expect(push.kinkRingGiven).not.toHaveBeenCalled();
  });

  it("says so when there's no ring left to give", async () => {
    const { service, push } = make([[ada], [], []]);
    await expect(service.give("me", "ada", now)).rejects.toBeInstanceOf(ConflictException);
    expect(push.kinkRingGiven).not.toHaveBeenCalled();
  });
});

describe("giveRingSchema", () => {
  it("takes a username and nothing else", () => {
    expect(giveRingSchema.safeParse({ username: " ada " }).data).toEqual({ username: "ada" });
    expect(giveRingSchema.safeParse({ username: "" }).success).toBe(false);
    expect(giveRingSchema.safeParse({ username: "ada", ringId: "x" }).success).toBe(false);
  });
});
