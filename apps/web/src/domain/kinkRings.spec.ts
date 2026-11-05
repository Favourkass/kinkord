import { describe, expect, it } from "vitest";
import {
  pairPriceFrom,
  toKinkRingsVM,
  toMemberRingsVM,
  ringCountsFrom,
  type KinkRingsLabels,
  type MemberRingsLabels,
  type MemberRingsPM,
} from "./kinkRings";

const labels: KinkRingsLabels = {
  count: (n) => `${n} to give`,
  expires: (date) => `Expires ${date}`,
  givenTo: (name, date) => `${name}, ${date}`,
  someoneGone: "Someone who left",
};
const href = (u: string | null) => (u ? `/u/${u}` : null);

describe("toKinkRingsVM", () => {
  it("lists each ring with its expiry, in Lagos dates, and counts them", () => {
    const vm = toKinkRingsVM(
      {
        available: [
          { id: "r1", expiresAt: "2026-11-26T12:00:00.000Z" },
          // 23:30 UTC is already the next day in Lagos.
          { id: "r2", expiresAt: "2026-12-25T23:30:00.000Z" },
        ],
        given: [],
      },
      labels,
      href,
    );
    expect(vm.count).toBe(2);
    expect(vm.heading).toBe("2 to give");
    expect(vm.rings).toEqual([
      { id: "r1", expires: "Expires 26 Nov 2026" },
      { id: "r2", expires: "Expires 26 Dec 2026" },
    ]);
  });

  it("says who each given ring went to, linking to them while they're here", () => {
    const vm = toKinkRingsVM(
      {
        available: [],
        given: [
          {
            id: "r0",
            givenAt: "2026-10-27T12:00:00.000Z",
            to: { username: "ada", displayName: "Ada" },
          },
          { id: "rx", givenAt: "2026-10-20T12:00:00.000Z", to: null },
        ],
      },
      labels,
      href,
    );
    expect(vm.given).toEqual([
      { id: "r0", line: "Ada, 27 Oct 2026", href: "/u/ada" },
      { id: "rx", line: "Someone who left, 20 Oct 2026", href: null },
    ]);
  });
});

it("marks rings expiring within seven days and distinguishes awards from purchases", async () => {
  const { toRingItemVM } = await import("./kinkRings");
  const ring = {
    id: "12345678-abcd",
    createdAt: "2026-10-01T00:00:00Z",
    expiresAt: "2026-11-01T00:00:00Z",
    source: "award" as const,
  };
  const vm = toRingItemVM(ring, new Date("2026-10-30T00:00:00Z"));
  expect(vm).toMatchObject({
    code: "KR-12345678",
    urgent: true,
    expired: false,
    remaining: "2 days left",
    received: "Received: 1 Oct 2026",
  });
  expect(toRingItemVM(ring, new Date(ring.expiresAt))).toMatchObject({
    expired: true,
    urgent: false,
    remaining: "Expired",
  });
});

/** The same wording as Moderation's copy, kept here: domain code can't read constants. */
const ringLabels: MemberRingsLabels = {
  summary: (c) =>
    `Balance: ${c.unused} to give · ${c.total} ${c.total === 1 ? "ring" : "rings"} in all · ${c.given} given · ${c.expired} expired${c.cancelled ? ` · ${c.cancelled} cancelled` : ""} · ${c.received} received`,
  batch: (period, confirmed) =>
    `${period === "yearly" ? "Yearly" : "Monthly"} Silver${confirmed ? ` · confirmed ${confirmed}` : ""}`,
  bought: (quantity, method, confirmed) =>
    `Bought ${quantity} rings with ${method === "coins" ? "KinkCoins" : "a bank transfer"}${confirmed ? ` · confirmed ${confirmed}` : ""}`,
  fromKinkord: "Given by Kinkord",
  ring: (seq) => `Ring ${seq}`,
  status: { unused: "Unused", given: "Given", expired: "Expired", cancelled: "Cancelled" },
  givenTo: (who, date) => `To ${who} on ${date}`,
  expires: (date) => `Expires ${date}`,
  expired: (date) => `Expired ${date}, never given`,
  cancelled: "Cancelled by an admin before it was given",
  withNote: "with a note",
  silverCancelled: "Silver cancelled",
  someoneGone: "a member who has since left",
  thisMember: "This member",
  receivedFrom: (who, date) => `From ${who} on ${date}`,
};

describe("toMemberRingsVM", () => {
  const rings: MemberRingsPM = {
    counts: { total: 3, unused: 1, given: 1, expired: 1, cancelled: 0, received: 1 },
    batches: [
      {
        paymentId: "pay-1",
        period: "yearly",
        confirmedAt: "2026-10-01T09:00:00.000Z",
        rings: [
          {
            id: "r1",
            seq: 1,
            status: "expired",
            expiresAt: "2026-10-31T09:00:00.000Z",
            givenAt: null,
            recipient: null,
            recipientLeft: false,
            withNote: false,
            silverCancelled: false,
          },
          {
            id: "r2",
            seq: 2,
            status: "given",
            expiresAt: "2026-11-30T09:00:00.000Z",
            givenAt: "2026-10-29T15:00:00.000Z",
            recipient: { id: "u2", username: "tega", displayName: "Tega" },
            recipientLeft: false,
            withNote: true,
            silverCancelled: false,
          },
          {
            id: "r3",
            seq: 3,
            status: "unused",
            expiresAt: "2026-12-30T09:00:00.000Z",
            givenAt: null,
            recipient: null,
            recipientLeft: false,
            withNote: false,
            silverCancelled: false,
          },
        ],
      },
    ],
    received: [
      {
        id: "r9",
        givenAt: "2026-11-02T10:00:00.000Z",
        giver: { id: "u3", username: "dove", displayName: null },
        withNote: false,
        silverCancelled: false,
      },
    ],
  };
  const href = (id: string) => `/moderation/members/${id}`;

  it("says, ring by ring, who got it and when the rest run out", () => {
    const vm = toMemberRingsVM(rings, ringLabels, href);
    expect(vm.summary).toBe(
      "Balance: 1 to give · 3 rings in all · 1 given · 1 expired · 1 received",
    );
    expect(vm.batches[0].heading).toBe("Yearly Silver · confirmed 1 Oct 2026");
    expect(vm.batches[0].rings.map((r) => [r.label, r.statusLabel, r.line, r.href])).toEqual([
      ["Ring 1", "Expired", "Expired 31 Oct 2026, never given", null],
      ["Ring 2", "Given", "To @tega (Tega) on 29 Oct 2026 · with a note", "/moderation/members/u2"],
      ["Ring 3", "Unused", "Expires 30 Dec 2026", null],
    ]);
    expect(vm.batches[0].rings.map((r) => r.cancelSilverOf)).toEqual([null, "@tega (Tega)", null]);
    expect(vm.received).toEqual([
      {
        id: "r9",
        line: "From @dove on 2 Nov 2026",
        href: "/moderation/members/u3",
        cancelSilverOf: "This member",
      },
    ]);
    expect(vm.canCancelUnused).toBe(true);
    expect(vm.empty).toBe(false);
  });

  it("shows rings an admin took back, and Silver already cancelled can't be cancelled again", () => {
    const [batch] = rings.batches;
    const vm = toMemberRingsVM(
      {
        counts: { total: 3, unused: 0, given: 1, expired: 1, cancelled: 1, received: 1 },
        batches: [
          {
            ...batch,
            rings: [
              batch.rings[0],
              { ...batch.rings[1], silverCancelled: true },
              { ...batch.rings[2], status: "cancelled" },
            ],
          },
        ],
        received: [{ ...rings.received[0], silverCancelled: true }],
      },
      ringLabels,
      href,
    );
    expect(vm.summary).toBe(
      "Balance: 0 to give · 3 rings in all · 1 given · 1 expired · 1 cancelled · 1 received",
    );
    expect(vm.batches[0].rings.map((r) => [r.statusLabel, r.line, r.cancelSilverOf])).toEqual([
      ["Expired", "Expired 31 Oct 2026, never given", null],
      ["Given", "To @tega (Tega) on 29 Oct 2026 · with a note · Silver cancelled", null],
      ["Cancelled", "Cancelled by an admin before it was given", null],
    ]);
    expect(vm.received[0]).toMatchObject({
      line: "From @dove on 2 Nov 2026 · Silver cancelled",
      cancelSilverOf: null,
    });
    expect(vm.canCancelUnused).toBe(false);
  });

  it("names Kinkord's own rings, and a receiver who has left", () => {
    const vm = toMemberRingsVM(
      {
        counts: { total: 1, unused: 0, given: 1, expired: 0, cancelled: 0, received: 0 },
        batches: [
          {
            paymentId: null,
            period: null,
            confirmedAt: null,
            rings: [
              {
                id: "k1",
                seq: 1,
                status: "given",
                expiresAt: "2026-11-30T09:00:00.000Z",
                givenAt: "2026-11-01T09:00:00.000Z",
                recipient: null,
                recipientLeft: true,
                withNote: false,
                silverCancelled: false,
              },
            ],
          },
        ],
        received: [],
      },
      ringLabels,
      href,
    );
    expect(vm.batches[0].heading).toBe("Given by Kinkord");
    expect(vm.batches[0].rings[0].line).toBe("To a member who has since left on 1 Nov 2026");
  });

  it("heads rings a member bought by what they bought and how they paid", () => {
    const vm = toMemberRingsVM(
      {
        counts: { total: 2, unused: 2, given: 0, expired: 0, cancelled: 0, received: 0 },
        batches: [
          {
            paymentId: "buy-1",
            period: null,
            bought: { quantity: 2, method: "coins" },
            confirmedAt: "2026-11-03T09:00:00.000Z",
            rings: [],
          },
          {
            paymentId: "buy-2",
            period: null,
            bought: { quantity: 4, method: "bank" },
            confirmedAt: null,
            rings: [],
          },
        ],
        received: [],
      },
      ringLabels,
      href,
    );
    expect(vm.batches.map((b) => b.heading)).toEqual([
      "Bought 2 rings with KinkCoins · confirmed 3 Nov 2026",
      "Bought 4 rings with a bank transfer",
    ]);
  });

  it("is empty with no rings either way", () => {
    const vm = toMemberRingsVM(
      {
        counts: { total: 0, unused: 0, given: 0, expired: 0, cancelled: 0, received: 0 },
        batches: [],
        received: [],
      },
      ringLabels,
      href,
    );
    expect(vm.empty).toBe(true);
  });
});

describe("ringCountsFrom", () => {
  it("reads whole numbers from 0 to the most a plan can bring", () => {
    expect(ringCountsFrom({ monthly: " 1 ", yearly: "6" }, 24)).toEqual({ monthly: 1, yearly: 6 });
    expect(ringCountsFrom({ monthly: "0", yearly: "24" }, 24)).toEqual({ monthly: 0, yearly: 24 });
  });

  it("refuses anything else", () => {
    for (const bad of ["", "-1", "1.5", "25", "six", "1e1"]) {
      expect(ringCountsFrom({ monthly: "1", yearly: bad }, 24)).toBeNull();
    }
  });
});

describe("pairPriceFrom", () => {
  it("reads a dollar amount as cents", () => {
    expect(pairPriceFrom("5")).toBe(500);
    expect(pairPriceFrom(" 4.99 ")).toBe(499);
    expect(pairPriceFrom("$5.5")).toBe(550);
    expect(pairPriceFrom("0.50")).toBe(50);
  });

  it("refuses anything that isn't one", () => {
    for (const bad of ["", "five", "4.999", "-5", "5,00", "1e3"])
      expect(pairPriceFrom(bad)).toBeNull();
  });
});
