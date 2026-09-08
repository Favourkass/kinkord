import { describe, expect, it } from "vitest";
import {
  toMemberCardVM,
  toPublicProfileVM,
  type MemberCardPM,
  type PublicProfilePM,
} from "./member";

const card: MemberCardPM = {
  userId: "u1",
  username: "naughty_neze",
  displayName: "Naughty Neze",
  avatarUrl: "https://s3/neze.jpg",
  age: 25,
  gender: "Female",
  city: "Abraka",
  state: "Delta",
  isOnline: true,
  lastSeenAt: "2026-09-08T11:59:00.000Z",
  postsCount: 24,
  followersCount: 1234,
  isFollowing: false,
};

describe("toMemberCardVM", () => {
  it("formats the brief's card: handle title, '25F • Female', 'Abraka, Delta State', compact counts", () => {
    expect(toMemberCardVM(card)).toEqual({
      userId: "u1",
      username: "naughty_neze",
      title: "naughty_neze",
      avatarUrl: "https://s3/neze.jpg",
      meta: "25F • Female",
      location: "Abraka, Delta State",
      isOnline: true,
      posts: "24",
      followers: "1.2K",
      isFollowing: false,
    });
  });

  it("falls back to the display name when a member has no handle and drops unknown parts", () => {
    const vm = toMemberCardVM({
      ...card,
      username: null,
      age: null,
      gender: null,
      city: null,
      state: null,
      isOnline: false,
    });
    expect(vm.title).toBe("Naughty Neze");
    expect(vm.meta).toBe("");
    expect(vm.location).toBeNull();
    expect(vm.isOnline).toBe(false);
  });
});

const now = new Date("2026-09-08T12:00:00Z");
const profile: PublicProfilePM = {
  userId: "u2",
  username: "nene",
  displayName: "Naughty Neze",
  avatarUrl: null,
  coverUrl: null,
  bio: "Exploring the limits.",
  country: "NG",
  state: "Delta",
  city: "Abraka",
  age: 25,
  gender: "Female",
  orientation: "Pansexual",
  relationshipStatus: "Single",
  bodyType: "Slim / Athletic",
  roles: ["Dominant", "Sadist"],
  interests: ["Bondage", "Leather"],
  lookingFor: ["Submissive"],
  languages: ["English", "Pidgin"],
  joinedAt: "2023-03-10T09:00:00.000Z",
  lastSeenAt: "2026-09-08T11:00:00.000Z",
  isOnline: false,
  counts: { friends: 1200, followers: 2300, following: 980 },
  isFollowing: true,
  isSelf: false,
};

describe("toPublicProfileVM", () => {
  it("builds the header lines from the design: handle, stats, location, tag line, presence", () => {
    const vm = toPublicProfileVM(profile, now);
    expect(vm.handle).toBe("@nene");
    expect(vm.stats).toEqual({ friends: "1.2K", followers: "2.3K", following: "980" });
    expect(vm.locationLine).toBe("Abraka, Delta State, Nigeria");
    expect(vm.tagLine).toBe("25F · Dominant | Sadist");
    expect(vm.lastSeenAgo).toBe("an hour ago");
    expect(vm.isOnline).toBe(false);
    expect(vm.languages).toBe("English, Pidgin");
    expect(vm.joined).toBe("March 2023");
    expect(vm.basic.age).toBe("25");
    expect(vm.isFollowing).toBe(true);
  });

  it("degrades gracefully when optional fields are missing", () => {
    const vm = toPublicProfileVM(
      {
        ...profile,
        username: null,
        age: null,
        roles: [],
        languages: [],
        city: null,
        state: null,
        country: null,
        lastSeenAt: null,
      },
      now,
    );
    expect(vm.handle).toBeNull();
    expect(vm.tagLine).toBeNull();
    expect(vm.locationLine).toBeNull();
    expect(vm.languages).toBeNull();
    expect(vm.basic.age).toBeNull();
    expect(vm.lastSeenAgo).toBeNull();
  });
});
