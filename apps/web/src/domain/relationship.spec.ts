import { describe, expect, it } from "vitest";
import { relationshipChoices, toRelationshipRowVM, type RelationshipPM } from "./relationship";

const pm: RelationshipPM = {
  id: "r1",
  kind: "ds",
  type: "dominant",
  label: "submissive of",
  member: { userId: "u2", username: "tolu", displayName: "Tolu", avatarUrl: "https://a.jpg" },
  requestedBy: "self",
  createdAt: "2026-10-20T09:00:00.000Z",
  acceptedAt: null,
};

describe("toRelationshipRowVM", () => {
  it("puts the label over the member, linking to their profile", () => {
    expect(toRelationshipRowVM(pm, (u) => `/u/${u}`)).toEqual({
      id: "r1",
      label: "submissive of",
      name: "Tolu",
      avatarUrl: "https://a.jpg",
      href: "/u/tolu",
    });
  });

  it("links nowhere for a member without a username", () => {
    const nameless = { ...pm, member: { ...pm.member, username: null } };
    expect(toRelationshipRowVM(nameless, (u) => `/u/${u}`).href).toBeNull();
  });
});

describe("relationshipChoices", () => {
  it("words each choice as what you'd be to them", () => {
    const choices = relationshipChoices(
      {
        ds: [{ type: "owner", dominant: "Owner", submissive: "pet" }],
        romantic: [{ type: "married", label: "Married to" }],
      },
      {
        ds: (o) => `${o.submissive} of them (they're your ${o.dominant})`,
        romantic: (o) => `${o.label} them`,
      },
    );
    expect(choices).toEqual({
      ds: [{ value: "owner", label: "pet of them (they're your Owner)" }],
      romantic: [{ value: "married", label: "Married to them" }],
    });
  });
});
