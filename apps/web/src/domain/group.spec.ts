import { describe, expect, it } from "vitest";
import {
  canSubmitThread,
  groupBadge,
  groupFormErrors,
  groupTabs,
  placeLabel,
  primaryAction,
  toGroupRowVM,
  toThreadRowVM,
  type GroupAccessPM,
  type GroupSummaryPM,
} from "./group";
import type { PostPM } from "./post";

const labels = {
  categories: {
    local: "Local & meetups",
    interests: "Kinks & interests",
    lifestyle: "Relationships & lifestyle",
    identity: "Identity & community",
    education: "Education & safety",
    social: "Chat & social",
    official: "Kinkord official",
  },
  privacy: { open: "Open", closed: "Closed" },
  roles: { owner: "Owner", moderator: "Moderator", member: "Member" },
  requested: "Requested",
  members: (n: number) => `${n} ${n === 1 ? "member" : "members"}`,
};
const countryName = (code: string | null) => (code === "NG" ? "Nigeria" : null);
const access = (over: Partial<GroupAccessPM> = {}): GroupAccessPM => ({
  member: false,
  pending: false,
  canRead: true,
  canPost: false,
  canModerate: false,
  isOwner: false,
  ...over,
});
const group = (over: Partial<GroupSummaryPM> = {}): GroupSummaryPM => ({
  id: "g1",
  slug: "lagos-munch",
  name: "Lagos Munch",
  description: "A monthly munch.",
  category: "local",
  privacy: "open",
  country: "NG",
  state: "Lagos",
  members: 12,
  role: null,
  status: null,
  ...over,
});

describe("group rows", () => {
  it("say what a group is about, where, and how big", () => {
    expect(toGroupRowVM(group(), labels, "/g/lagos-munch", countryName)).toMatchObject({
      meta: "Local & meetups · Lagos, Nigeria · 12 members",
      privacy: "Open",
      closed: false,
      badge: null,
    });
    expect(
      toGroupRowVM(group({ state: null, country: null, members: 1 }), labels, "/x", countryName)
        .meta,
    ).toBe("Local & meetups · 1 member");
  });

  it("show the viewer's place in a group", () => {
    expect(groupBadge({ role: "member", status: "pending" }, labels)).toBe("Requested");
    expect(groupBadge({ role: "owner", status: "active" }, labels)).toBe("Owner");
    expect(groupBadge({ role: null, status: null }, labels)).toBeNull();
  });

  it("name the place the best they can", () => {
    expect(placeLabel("Lagos", "NG", countryName)).toBe("Lagos, Nigeria");
    expect(placeLabel(null, "NG", countryName)).toBe("Nigeria");
    expect(placeLabel(null, null, countryName)).toBeNull();
  });
});

describe("a group's page", () => {
  it("offers join, ask, cancel or leave, and nothing to the owner", () => {
    expect(primaryAction(access(), "open")).toBe("join");
    expect(primaryAction(access({ canRead: false }), "closed")).toBe("ask");
    expect(primaryAction(access({ pending: true }), "closed")).toBe("cancel");
    expect(primaryAction(access({ member: true, canPost: true }), "open")).toBe("leave");
    expect(primaryAction(access({ member: true, isOwner: true }), "open")).toBeNull();
  });

  it("shows members only to readers, and requests only to a closed group's moderators", () => {
    expect(groupTabs(access({ canRead: false }), "closed")).toEqual(["discussions", "about"]);
    expect(groupTabs(access(), "open")).toEqual(["discussions", "about", "members"]);
    expect(groupTabs(access({ canModerate: true }), "open")).toEqual([
      "discussions",
      "about",
      "members",
    ]);
    expect(groupTabs(access({ canModerate: true }), "closed")).toEqual([
      "discussions",
      "about",
      "members",
      "requests",
    ]);
  });
});

describe("forms", () => {
  it("need a real title and a message to post a discussion", () => {
    expect(canSubmitThread("Hi", "hello")).toBe(false);
    expect(canSubmitThread("First munch", "   ")).toBe(false);
    expect(canSubmitThread("First munch", "Who's coming?")).toBe(true);
  });

  it("check a group's name, description and rules before sending", () => {
    expect(groupFormErrors({ name: "ok", description: "short", rules: "" })).toEqual({
      name: "Use 3–60 characters.",
      description: "Use 10–2,000 characters.",
    });
    expect(
      groupFormErrors({
        name: "Lagos Munch",
        description: "A monthly munch.",
        rules: "x".repeat(4001),
      }),
    ).toEqual({ rules: "Keep the rules under 4,000 characters." });
  });
});

describe("discussion rows", () => {
  it("show the title, the latest activity and a short excerpt", () => {
    const pm = {
      id: "p1",
      title: "First munch",
      body: "Saturday at 4.\n\nWho's coming? " + "x".repeat(200),
      author: { displayName: "Ada", avatarUrl: null },
      comments: 3,
      createdAt: "2026-10-01T00:00:00Z",
      lastActivityAt: "2026-10-20T00:00:00Z",
      pinned: true,
      closed: false,
    } as unknown as PostPM;
    const row = toThreadRowVM(
      pm,
      "/g/x/t/p1",
      (n) => `${n} replies`,
      (iso) => `at ${iso}`,
    );
    expect(row).toMatchObject({
      title: "First munch",
      time: "at 2026-10-20T00:00:00Z",
      replies: "3 replies",
      pinned: true,
      closed: false,
    });
    expect(row.excerpt.startsWith("Saturday at 4. Who's coming?")).toBe(true);
    expect(row.excerpt.length).toBeLessThanOrEqual(140);
  });
});
