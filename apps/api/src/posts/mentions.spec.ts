import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { knownHandles, MAX_MENTIONS, mentionCandidates, mentionsIn } from "./mentions";

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
