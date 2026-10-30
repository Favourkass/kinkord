import { describe, expect, it } from "vitest";
import { toKinkRingsVM, type KinkRingsLabels } from "./kinkRings";

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
