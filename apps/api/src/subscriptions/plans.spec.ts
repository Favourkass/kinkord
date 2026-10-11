import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { post, user } from "../db/schema";
import {
  addPeriod,
  DEFAULT_PRICES,
  freeOffset,
  hasSilver,
  paymentReference,
  silverCheck,
  silverCheckStatus,
  silverSince,
  silverUntil,
  usdCentsFor,
} from "./plans";

/** Each `await` on the stub takes the next queued answer. */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_t, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return () => chain();
      },
    });
  return chain() as never;
}

describe("paymentReference", () => {
  it("is KIN and the Lagos time to the second", () => {
    // 10:42:38 UTC is 11:42:38 in Lagos.
    expect(paymentReference(new Date("2026-09-24T10:42:38Z"))).toBe("KIN20260924114238");
  });

  it("rolls the date over at Lagos midnight", () => {
    expect(paymentReference(new Date("2026-12-31T23:05:09Z"))).toBe("KIN20270101000509");
  });
});

describe("freeOffset", () => {
  const first = () => 0;

  it("uses two digits while there are some free", () => {
    expect(freeOffset(new Set(), first)).toBe(1);
    expect(freeOffset(new Set([1, 2, 3]), first)).toBe(4);
    expect(freeOffset(new Set(), () => 0.999)).toBe(99);
  });

  it("moves to three digits when every two-digit amount is open", () => {
    const taken = new Set(Array.from({ length: 99 }, (_, i) => i + 1));
    expect(freeOffset(taken, first)).toBe(100);
  });

  it("gives up when all of them are open", () => {
    const taken = new Set(Array.from({ length: 999 }, (_, i) => i + 1));
    expect(freeOffset(taken, first)).toBeNull();
  });
});

describe("usdCentsFor", () => {
  it("prices the extra naira at the plan's own rate, as the design shows", () => {
    expect(usdCentsFor(3_364_700, DEFAULT_PRICES.yearly)).toBe(2403);
    expect(usdCentsFor(DEFAULT_PRICES.monthly.kobo, DEFAULT_PRICES.monthly)).toBe(400);
  });
});

describe("addPeriod", () => {
  it("adds a calendar month or year", () => {
    expect(addPeriod(new Date("2026-10-06T12:00:00Z"), "monthly")).toEqual(
      new Date("2026-11-06T12:00:00Z"),
    );
    expect(addPeriod(new Date("2026-10-06T12:00:00Z"), "yearly")).toEqual(
      new Date("2027-10-06T12:00:00Z"),
    );
  });

  it("lands the 31st on the last day of a shorter month", () => {
    expect(addPeriod(new Date("2027-01-31T09:00:00Z"), "monthly")).toEqual(
      new Date("2027-02-28T09:00:00Z"),
    );
    expect(addPeriod(new Date("2028-02-29T09:00:00Z"), "yearly")).toEqual(
      new Date("2029-02-28T09:00:00Z"),
    );
  });
});

describe("silverUntil", () => {
  it("is the end of a running subscription", async () => {
    const end = new Date("2026-11-06T12:00:00Z");
    await expect(silverUntil(queuedDb([[{ end }]]), "u1")).resolves.toEqual(end);
    await expect(hasSilver(queuedDb([[{ end }]]), "u1")).resolves.toBe(true);
  });

  it("is null on Basic", async () => {
    await expect(silverUntil(queuedDb([[]]), "u1")).resolves.toBeNull();
    await expect(hasSilver(queuedDb([[]]), "u1")).resolves.toBe(false);
  });
});

describe("silverCheck", () => {
  const render = (expr: SQL) => new PgDialect().sqlToQuery(expr).sql.replace(/\s+/g, " ");

  it("asks for running Silver, no hold, and photos, however new the account", () => {
    const text = render(silverCheck(post.authorId));
    expect(text).toContain('from "member_subscription" "check_sub"');
    expect(text).toContain('"check_sub"."user_id" = "post"."author_id"');
    expect(text).toContain('"check_sub"."current_period_end" > now()');
    expect(text).toContain('"check_sub"."check_held_at" is null');
    expect(text).toContain('"check_profile"."avatar_key" is not null');
    expect(text).toContain('"check_profile"."cover_key" is not null');
    expect(text).not.toContain("created_at");
  });

  it("reads its own aliases, so it still points at the outer member inside a query on users", () => {
    const text = render(silverCheck(user.id));
    expect(text).toContain(
      'inner join "profile" "check_profile" on "check_profile"."user_id" = "check_sub"."user_id"',
    );
    expect(text).toContain('"check_sub"."user_id" = "user"."id"');
  });
});

describe("silverCheckStatus", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const row = (over: Record<string, unknown> = {}) => ({
    heldAt: null,
    heldFor: null,
    avatarKey: "a",
    coverKey: "c",
    ...over,
  });

  it("is null without Silver, and shown when every rule is met, even on a day-old account", async () => {
    await expect(silverCheckStatus(queuedDb([[]]), "u1", now)).resolves.toBeNull();
    await expect(silverCheckStatus(queuedDb([[row()]]), "u1", now)).resolves.toEqual({
      shown: true,
      reason: null,
      heldFor: null,
    });
  });

  it("says what's missing: a review or photos", async () => {
    await expect(
      silverCheckStatus(queuedDb([[row({ heldAt: now, heldFor: "username" })]]), "u1", now),
    ).resolves.toEqual({ shown: false, reason: "held", heldFor: "username" });
    await expect(
      silverCheckStatus(queuedDb([[row({ coverKey: null })]]), "u1", now),
    ).resolves.toEqual({ shown: false, reason: "photos", heldFor: null });
  });
});

describe("silverSince", () => {
  it("is when a member showing the check began, or null", async () => {
    const since = new Date("2026-10-06T12:00:00Z");
    await expect(silverSince(queuedDb([[{ since }]]), "u1")).resolves.toEqual(since);
    await expect(silverSince(queuedDb([[]]), "u1")).resolves.toBeNull();
  });
});
