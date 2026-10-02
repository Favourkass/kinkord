import { describe, expect, it } from "vitest";
import {
  ageTagOf,
  locationOf,
  locationPartsOf,
  socialHandle,
  toMediaTiles,
  toMemberCardVM,
  toPublicProfileVM,
  type MemberCardPM,
  type PlaceHref,
  type PublicProfilePM,
} from "./member";

const card: MemberCardPM = {
  userId: "u1",
  username: "naughty_neze",
  displayName: "Naughty Neze",
  avatarUrl: "https://s3/neze.jpg",
  age: 25,
  gender: "Female",
  roles: ["Submissive", "Switch"],
  city: "Abraka",
  state: "Delta",
  isOnline: true,
  lastSeenAt: "2026-09-08T11:59:00.000Z",
  postsCount: 24,
  followersCount: 1234,
  isFollowing: false,
};

describe("toMemberCardVM", () => {
  it("formats the card: handle title, '25F' + roles, 'Abraka, Delta State', compact counts", () => {
    expect(toMemberCardVM(card)).toEqual({
      userId: "u1",
      username: "naughty_neze",
      title: "naughty_neze",
      avatarUrl: "https://s3/neze.jpg",
      ageTag: "25F",
      roles: "Submissive | Switch",
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
      roles: [],
      city: null,
      state: null,
      isOnline: false,
    });
    expect(vm.title).toBe("Naughty Neze");
    expect(vm.ageTag).toBeNull();
    expect(vm.roles).toBeNull();
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
  counts: { friends: 1200, followers: 2300, following: 980, mutualFriends: 86 },
  isFollowing: true,
  isSelf: false,
  nationality: null,
  occupation: null,
  limits: null,
  socialLinks: {},
  restricted: false,
  dateOfBirth: null,
  verification: { email: false, phone: false },
};

describe("toPublicProfileVM", () => {
  it("builds the header lines from the design: handle, stats, location, tag line, presence", () => {
    const vm = toPublicProfileVM(profile, () => null, now);
    expect(vm.handle).toBe("@nene");
    expect(vm.stats).toEqual({
      friends: "1.2K",
      followers: "2.3K",
      following: "980",
      mutualFriends: "86",
    });
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
      () => null,
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

describe("About cards + media (profile rebuild, 2026-09-12)", () => {
  const base: PublicProfilePM = {
    userId: "u2",
    username: "nene",
    displayName: "Naughty Neze",
    avatarUrl: null,
    coverUrl: null,
    bio: "Hi",
    country: "NG",
    state: "Delta",
    city: "Abraka",
    age: 25,
    gender: "female",
    orientation: null,
    relationshipStatus: "Single",
    bodyType: null,
    roles: ["Dominant"],
    interests: ["Bondage"],
    lookingFor: ["Events"],
    languages: ["English", "Pidgin"],
    joinedAt: "2025-05-25T10:00:00.000Z",
    lastSeenAt: null,
    isOnline: false,
    counts: { friends: 1, followers: 2, following: 3, mutualFriends: 0 },
    isFollowing: false,
    isSelf: false,
    nationality: "NG",
    occupation: "Entrepreneur",
    limits: "No blood",
    socialLinks: { facebook: "https://facebook.com/naughty_neze/", x: "https://x.com/@nene" },
    restricted: false,
    dateOfBirth: null,
    verification: { email: true, phone: false },
  };

  it("builds the Personal Information rows, social tiles, verification and Member since", () => {
    const vm = toPublicProfileVM(base);
    expect(vm.personal).toEqual({
      age: "25",
      dateOfBirth: null,
      gender: "Female",
      location: "Abraka, Delta State",
      relationshipStatus: "Single",
      nationality: "Nigeria",
      occupation: "Entrepreneur",
      languages: "English, Pidgin",
    });
    expect(vm.roles).toEqual(["Dominant"]);
    expect(vm.limits).toBe("No blood");
    expect(vm.socialLinks).toEqual([
      { platform: "facebook", url: "https://facebook.com/naughty_neze/", handle: "@naughty_neze" },
      { platform: "x", url: "https://x.com/@nene", handle: "@nene" },
    ]);
    expect(vm.verification).toEqual({ level: "basic", email: true, phone: false });
    expect(vm.memberSince).toBe("25 May 2025");
    expect(vm.restricted).toBe(false);
  });

  it("shows the birth date only when the API sent it (your own profile) and handles restricted", () => {
    const own = toPublicProfileVM({ ...base, isSelf: true, dateOfBirth: "2001-02-14" });
    expect(own.personal.dateOfBirth).toBe("14 February 2001");
    const locked = toPublicProfileVM({
      ...base,
      restricted: true,
      bio: null,
      socialLinks: {},
      verification: { email: false, phone: false },
    });
    expect(locked.restricted).toBe(true);
    expect(locked.socialLinks).toEqual([]);
    expect(locked.verification.level).toBe("none");
  });

  it("derives handles from links and features the current profile photo", () => {
    expect(socialHandle("https://x.com/naughty_neze")).toBe("@naughty_neze");
    expect(socialHandle("https://facebook.com/")).toBe("facebook.com");
    expect(socialHandle("not a url")).toBe("not a url");
    const tiles = toMediaTiles([
      {
        id: "a",
        kind: "avatar",
        url: "u",
        fullUrl: "f",
        createdAt: "x",
        isCurrent: true,
        deletable: true,
      },
      {
        id: "b",
        kind: "cover",
        url: "u",
        fullUrl: "f",
        createdAt: "x",
        isCurrent: true,
        deletable: true,
      },
      {
        id: "c",
        kind: "avatar",
        url: "u",
        fullUrl: "f",
        createdAt: "x",
        isCurrent: false,
        deletable: true,
      },
    ]);
    expect(tiles.map((t) => [t.id, t.featured])).toEqual([
      ["a", true],
      ["b", false],
      ["c", false],
    ]);
  });

  it("carries through that a post's photo cannot be deleted from the profile grid", () => {
    // It belongs to a post — removing it there would leave the post with a hole.
    const tiles = toMediaTiles([
      {
        id: "p1",
        kind: "photo",
        url: "u",
        fullUrl: "f",
        createdAt: "x",
        isCurrent: false,
        deletable: false,
      },
      {
        id: "a",
        kind: "avatar",
        url: "u",
        fullUrl: "f",
        createdAt: "x",
        isCurrent: true,
        deletable: true,
      },
    ]);
    expect(tiles.map((t) => [t.id, t.deletable])).toEqual([
      ["p1", false],
      ["a", true],
    ]);
  });
});

describe("ageTagOf / locationOf", () => {
  // Directory cards, the profile header and every People row read these, so a
  // member must never be labelled two different ways on two screens.
  it("builds the age tag the way every surface shows it", () => {
    expect(ageTagOf(25, "Female")).toBe("25F");
    expect(ageTagOf(25, "Male")).toBe("25M");
    expect(ageTagOf(25, null)).toBe("25");
    expect(ageTagOf(25, "Non-binary")).toBe("25");
  });

  it("has no tag at all when the age is unknown", () => {
    // A bare gender initial with no number reads like a typo on a card.
    expect(ageTagOf(null, "Female")).toBeNull();
    expect(ageTagOf(null, null)).toBeNull();
  });

  it("joins city and state, and suffixes the state once", () => {
    expect(locationOf("Abraka", "Delta")).toBe("Abraka, Delta State");
    expect(locationOf(null, "Delta")).toBe("Delta State");
    expect(locationOf("Abraka", null)).toBe("Abraka");
    expect(locationOf(null, "Delta State")).toBe("Delta State");
    expect(locationOf(null, "FCT Abuja")).toBe("FCT Abuja");
  });

  it("is null when there is no location at all, so no empty line renders", () => {
    expect(locationOf(null, null)).toBeNull();
  });
});

describe("locationPartsOf", () => {
  // Tapping a place on someone's profile is the fastest route to people near them.
  const href: PlaceHref = ({ country, state, city }) => {
    if (country !== "NG") return null;
    if (!state) return "/members/ng";
    if (!city) return `/members/ng/${state}`;
    return `/members/ng/${state}?region=${city}`;
  };

  it("splits the line into city, state and country, each linking one level wider", () => {
    expect(locationPartsOf({ country: "NG", state: "Lagos", city: "Sangotedo" }, href)).toEqual([
      { label: "Sangotedo", href: "/members/ng/Lagos?region=Sangotedo" },
      { label: "Lagos State", href: "/members/ng/Lagos" },
      { label: "Nigeria", href: "/members/ng" },
    ]);
  });

  it("leaves out the pieces a member has not set", () => {
    expect(locationPartsOf({ country: "NG", state: "Lagos", city: null }, href)).toEqual([
      { label: "Lagos State", href: "/members/ng/Lagos" },
      { label: "Nigeria", href: "/members/ng" },
    ]);
    expect(locationPartsOf({ country: null, state: null, city: null }, href)).toEqual([]);
  });

  it("renders a country we do not serve as plain text rather than a dead link", () => {
    // A link into an empty directory is worse than no link.
    expect(locationPartsOf({ country: "GH", state: "Accra", city: null }, href)).toEqual([
      { label: "Accra State", href: null },
      { label: "Ghana", href: null },
    ]);
  });
});
