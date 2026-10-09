import { describe, expect, it } from "vitest";
import type { MemberCardPM } from "./member";
import { bodyParts, insertMention, mentionAt, toMentionSuggestionVM } from "./mentions";

const href = (u: string) => `/u/${u}`;

describe("bodyParts", () => {
  it("links each @handle the API confirmed, as typed, and leaves the rest as text", () => {
    expect(bodyParts("brunch with @Tega and @ghost.", ["tega"], href)).toEqual([
      { text: "brunch with " },
      { mention: "@Tega", href: "/u/tega" },
      { text: " and @ghost." },
    ]);
  });

  it("keeps a sentence's full stop out of the handle, and an email address unlinked", () => {
    expect(bodyParts("thanks @ada. mail ada@kinkord.com", ["ada"], href)).toEqual([
      { text: "thanks " },
      { mention: "@ada", href: "/u/ada" },
      { text: ". mail ada@kinkord.com" },
    ]);
  });

  it("links a username that ends in a dot in full when that's the member", () => {
    expect(bodyParts("hi @ada.", ["ada."], href)).toEqual([
      { text: "hi " },
      { mention: "@ada.", href: "/u/ada." },
    ]);
  });

  it("links nobody from a word longer than a username, whatever it starts with", () => {
    const thirty = "a".repeat(30);
    expect(bodyParts(`hi @${thirty}bc`, [thirty], href)).toEqual([{ text: `hi @${thirty}bc` }]);
    expect(bodyParts(`hi @${thirty}.`, [thirty], href)).toEqual([
      { text: "hi " },
      { mention: `@${thirty}`, href: `/u/${thirty}` },
      { text: "." },
    ]);
  });

  it("is plain text when nobody is confirmed, and nothing for no body", () => {
    expect(bodyParts("hi @ada", undefined, href)).toEqual([{ text: "hi @ada" }]);
    expect(bodyParts("", ["ada"], href)).toEqual([]);
  });
});

describe("mentionAt", () => {
  it("finds the @ being typed at the caret, even with nothing after it yet", () => {
    expect(mentionAt("hi @ad", 6)).toEqual({ start: 3, query: "ad" });
    expect(mentionAt("@", 1)).toEqual({ start: 0, query: "" });
    expect(mentionAt("hi @ada there", 7)).toEqual({ start: 3, query: "ada" });
  });

  it("is nothing past a space, inside an email address, or away from the caret", () => {
    expect(mentionAt("hi @ada ", 8)).toBeNull();
    expect(mentionAt("ada@kin", 7)).toBeNull();
    expect(mentionAt("hi @ada there", 13)).toBeNull();
  });
});

describe("insertMention", () => {
  it("swaps the @ being typed for the username and a space, the caret after it", () => {
    expect(insertMention("hi @ad", { start: 3, query: "ad" }, "ada_o")).toEqual({
      text: "hi @ada_o ",
      caret: 10,
    });
  });

  it("replaces the whole handle when the caret is inside it", () => {
    expect(insertMention("hello @adrian today", { start: 6, query: "ad" }, "ada")).toEqual({
      text: "hello @ada today",
      caret: 11,
    });
  });

  it("doesn't double a space already after the caret", () => {
    expect(insertMention("hi @ad there", { start: 3, query: "ad" }, "ada")).toEqual({
      text: "hi @ada there",
      caret: 8,
    });
  });
});

describe("toMentionSuggestionVM", () => {
  const pm = (over: Partial<MemberCardPM> = {}): MemberCardPM => ({
    userId: "u1",
    username: "ada",
    displayName: "Ada Okafor",
    avatarUrl: null,
    age: null,
    gender: null,
    roles: [],
    city: null,
    state: null,
    isOnline: false,
    lastSeenAt: null,
    postsCount: 0,
    followersCount: 0,
    isFollowing: false,
    silver: true,
    ...over,
  });

  it("suggests only members with a username", () => {
    expect(toMentionSuggestionVM(pm())).toEqual({
      userId: "u1",
      username: "ada",
      name: "Ada Okafor",
      avatarUrl: null,
      silver: true,
    });
    expect(toMentionSuggestionVM(pm({ username: null }))).toBeNull();
  });
});
