import { describe, expect, it } from "vitest";
import { toSilverMemberVM, type SilverMemberPM, type SilverMembersLabels } from "./silverMembers";

/** The same wording as Moderation's copy, kept here: domain code can't read constants. */
const labels: SilverMembersLabels = {
  sources: {
    subscription: "Subscription",
    ring: "Kink Ring",
    both: "Subscription + Kink Ring",
    given: "Given by Kinkord",
    other: "Other",
  },
  plans: { monthly: "monthly", yearly: "yearly" },
  until: (date) => `Silver until ${date}`,
  forGood: "Silver for good",
};
const date = (iso: string) => iso.slice(0, 10);
const href = (id: string) => `/moderation/members/${id}`;
const member = (change: Partial<SilverMemberPM>): SilverMemberPM => ({
  id: "u1",
  username: "tega",
  displayName: "Tega",
  source: "ring",
  until: "2026-12-03T12:00:00.000Z",
  forGood: false,
  plan: null,
  ...change,
});

describe("toSilverMemberVM", () => {
  it("names the member, how they got Silver, and when it runs out", () => {
    expect(toSilverMemberVM(member({}), labels, date, href)).toEqual({
      id: "u1",
      name: "@tega (Tega)",
      source: "ring",
      sourceLabel: "Kink Ring",
      detail: "Silver until 2026-12-03",
      href: "/moderation/members/u1",
    });
  });

  it("adds the plan they paid for, and says when Silver never runs out", () => {
    const paid = toSilverMemberVM(
      member({
        username: "sweetdaddydom",
        displayName: null,
        source: "subscription",
        plan: "yearly",
      }),
      labels,
      date,
      href,
    );
    expect([paid.name, paid.sourceLabel]).toEqual(["@sweetdaddydom", "Subscription · yearly"]);
    const given = toSilverMemberVM(
      member({ source: "given", forGood: true, plan: "monthly" }),
      labels,
      date,
      href,
    );
    expect([given.sourceLabel, given.detail]).toEqual(["Given by Kinkord", "Silver for good"]);
  });
});
