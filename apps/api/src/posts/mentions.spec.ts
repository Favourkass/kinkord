import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { knownHandles, MAX_HANDLES, MAX_MENTIONS, mentionCandidates, mentionsIn } from "./mentions";

describe("mentionCandidates", () => {
  it("finds @handles at the start, after spaces and after punctuation, lowercased", () => {
    expect(mentionCandidates("@Ada lunch with (@tega_m), @ada and @Ra.ven!")).toEqual([
      "ada",
      "tega_m",
      "ra.ven",
    ]);
  });

  it("looks up a handle ending in dots both ways: a username may end in one", () => {
    expect(mentionCandidates("thanks @tega.")).toEqual(["tega.", "tega"]);
  });

  it("takes the whole word: a longer one isn't a username, whatever its first 30 characters are", () => {
    const thirty = "a".repeat(30);
    expect(mentionCandidates(`@${thirty}b`)).toEqual([]);
    expect(mentionCandidates(`@${thirty}.b`)).toEqual([]);
    // Still a username before the sentence's full stop, or an ellipsis.
    expect(mentionCandidates(`thanks @${thirty}.`)).toEqual([thirty]);
    expect(mentionCandidates(`@${thirty}...`)).toEqual([thirty]);
  });

  it("looks at the first thirty different handles only, so the lookup stays small", () => {
    const many = Array.from({ length: 3_500 }, (_, i) => `@user${i}.`).join(" ");
    // Each is looked up both ways (with and without the dot).
    expect(mentionCandidates(many)).toHaveLength(MAX_HANDLES * 2);
    expect(mentionCandidates(`${many} @ada`)).not.toContain("ada");
    // Saying one again doesn't use up the room, and nor does a word no username could be.
    const repeats = `${"@tega ".repeat(100)}@${"a".repeat(40)} @ada`;
    expect(mentionCandidates(repeats)).toEqual(["tega", "ada"]);
  });

  it("strips a long run of dots quickly", () => {
    const started = Date.now();
    expect(mentionCandidates(`@${".".repeat(50_000)}a`)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("leaves email addresses and too-short handles alone", () => {
    expect(mentionCandidates("mail ada@kinkord.com, ping @ab")).toEqual([]);
    expect(mentionCandidates(null)).toEqual([]);
    expect(mentionCandidates("@@ada")).toEqual([]);
  });
});

describe("mentionsIn", () => {
  it("takes a handle as written when that's a member, else without the sentence's full stop", () => {
    expect(mentionsIn("thanks @tega.", new Set(["tega"]))).toEqual(["tega"]);
    expect(mentionsIn("hi @ada.", new Set(["ada.", "ada"]))).toEqual(["ada."]);
    expect(mentionsIn("hi @ghost", new Set(["ada"]))).toEqual([]);
  });

  it("mentions nobody for a word longer than a username", () => {
    const thirty = "a".repeat(30);
    expect(mentionsIn(`@${thirty}bc`, new Set([thirty]))).toEqual([]);
    expect(mentionsIn(`see @${thirty}.`, new Set([thirty]))).toEqual([thirty]);
  });

  it("names each member once, and ten at most", () => {
    const names = Array.from({ length: 15 }, (_, i) => `member${i}`);
    const text = names.map((n) => `@${n} @${n}`).join(" ");
    expect(mentionsIn(text, new Set(names))).toHaveLength(MAX_MENTIONS);
    expect(mentionsIn("@ada @Ada", new Set(["ada"]))).toEqual(["ada"]);
  });
});

describe("knownHandles", () => {
  it("asks nothing for no names, and only for members who can be shown, with their ids", async () => {
    const where = vi.fn(async () => [{ username: "ada", id: "u1" }]);
    const db = { select: vi.fn(() => ({ from: () => ({ where }) })) } as never;
    await expect(knownHandles(db, [])).resolves.toEqual(new Map());
    expect(where).not.toHaveBeenCalled();
    await expect(knownHandles(db, ["ada", "ghost", "ada"])).resolves.toEqual(
      new Map([["ada", "u1"]]),
    );
    const query = new PgDialect().sqlToQuery((where.mock.calls[0] as unknown as [SQL])[0]);
    expect(query.sql).toContain('"user"."username" in ($1, $2)');
    expect(query.sql).toContain('not exists (select 1 from "member_ban"');
  });
});
