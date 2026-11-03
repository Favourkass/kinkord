import { describe, expect, it } from "vitest";
import {
  toKinkRingsVM,
  toMemberRingsVM,
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
    `${c.total} ${c.total === 1 ? "ring" : "rings"} · ${c.unused} unused · ${c.given} given · ${c.expired} expired · ${c.received} received`,
  batch: (period, confirmed) =>
    `${period === "yearly" ? "Yearly" : "Monthly"} Silver${confirmed ? ` · confirmed ${confirmed}` : ""}`,
  fromKinkord: "Given by Kinkord",
  ring: (seq) => `Ring ${seq}`,
  status: { unused: "Unused", given: "Given", expired: "Expired" },
  givenTo: (who, date) => `To ${who} on ${date}`,
  expires: (date) => `Expires ${date}`,
  expired: (date) => `Expired ${date}, never given`,
  withNote: "with a note",
  someoneGone: "a member who has since left",
  receivedFrom: (who, date) => `From ${who} on ${date}`,
};

describe("toMemberRingsVM", () => {
  const rings: MemberRingsPM = {
    counts: { total: 3, unused: 1, given: 1, expired: 1, received: 1 },
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
      },
    ],
  };
  const href = (id: string) => `/moderation/members/${id}`;

  it("says, ring by ring, who got it and when the rest run out", () => {
    const vm = toMemberRingsVM(rings, ringLabels, href);
    expect(vm.summary).toBe("3 rings · 1 unused · 1 given · 1 expired · 1 received");
    expect(vm.batches[0].heading).toBe("Yearly Silver · confirmed 1 Oct 2026");
    expect(vm.batches[0].rings.map((r) => [r.label, r.statusLabel, r.line, r.href])).toEqual([
      ["Ring 1", "Expired", "Expired 31 Oct 2026, never given", null],
      ["Ring 2", "Given", "To @tega (Tega) on 29 Oct 2026 · with a note", "/moderation/members/u2"],
      ["Ring 3", "Unused", "Expires 30 Dec 2026", null],
    ]);
    expect(vm.received).toEqual([
      { id: "r9", line: "From @dove on 2 Nov 2026", href: "/moderation/members/u3" },
    ]);
    expect(vm.empty).toBe(false);
  });

  it("names Kinkord's own rings, and a receiver who has left", () => {
    const vm = toMemberRingsVM(
      {
        counts: { total: 1, unused: 0, given: 1, expired: 0, received: 0 },
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

  it("is empty with no rings either way", () => {
    const vm = toMemberRingsVM(
      {
        counts: { total: 0, unused: 0, given: 0, expired: 0, received: 0 },
        batches: [],
        received: [],
      },
      ringLabels,
      href,
    );
    expect(vm.empty).toBe(true);
  });
});
