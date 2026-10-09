import { describe, expect, it } from "vitest";
import type { MemberCardPM } from "./member";
import { isSearchTab, peopleQuery, toSearchPersonVM } from "./search";

const pm = (over: Partial<MemberCardPM> = {}): MemberCardPM => ({
  userId: "u1",
  username: "ada",
  displayName: "Ada Okafor",
  avatarUrl: "https://media/a.jpg",
  age: 25,
  gender: "Female",
  roles: ["Switch"],
  city: "Ikeja",
  state: "Lagos",
  isOnline: true,
  lastSeenAt: null,
  postsCount: 3,
  followersCount: 12,
  isFollowing: false,
  silver: true,
  ...over,
});
const href = (h: string) => `/u/${h}`;

describe("toSearchPersonVM", () => {
  it("shows the name, the handle and place in one line, and the Silver badge", () => {
    expect(toSearchPersonVM(pm(), href)).toEqual({
      userId: "u1",
      name: "Ada Okafor",
      handle: "@ada",
      details: "25F · Ikeja, Lagos State",
      avatarUrl: "https://media/a.jpg",
      silver: true,
      isFollowing: false,
      href: "/u/ada",
      canFollow: true,
    });
  });

  it("has no link and no Follow button for a member without a username", () => {
    const vm = toSearchPersonVM(
      pm({ username: null, age: null, city: null, state: null, silver: undefined }),
      href,
    );
    expect(vm).toMatchObject({ handle: null, details: null, href: null, canFollow: false });
    expect(vm.silver).toBe(false);
  });
});

describe("isSearchTab", () => {
  it("knows the three tabs and nothing else", () => {
    expect(["all", "people", "posts"].every(isSearchTab)).toBe(true);
    expect(isSearchTab("groups")).toBe(false);
  });
});

describe("peopleQuery", () => {
  it("looks people up without the @, as the API does", () => {
    expect(peopleQuery("@ada")).toBe("ada");
    expect(peopleQuery("@@ ada")).toBe("ada");
    expect(peopleQuery("Ada Okafor")).toBe("Ada Okafor");
  });

  it("is nothing for an @ alone", () => {
    expect(peopleQuery("@")).toBe("");
    expect(peopleQuery("@@")).toBe("");
  });
});
