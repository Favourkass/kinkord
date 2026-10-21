import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { profileRelationships, relationshipRows } from "./profile-relationships";

/** Each `await` takes the next queued answer; the calls are kept to check what was asked. */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  return { db: chain() as never, calls };
}

const storage = {
  presignDownload: vi.fn(
    async (key: string, variant?: string) => `https://media/${key}?${variant}`,
  ),
};

const row = (over: Record<string, unknown>) => ({
  id: "r1",
  kind: "ds",
  type: "dominant",
  requesterId: "sub",
  createdAt: new Date("2026-10-20T09:00:00Z"),
  acceptedAt: new Date("2026-10-21T09:00:00Z"),
  userId: "dom",
  username: "tolu",
  displayName: "Tolu",
  avatarKey: "avatars/dom/a.jpg",
  ...over,
});

const whereOf = (calls: Array<{ op: string; args: unknown[] }>) =>
  new PgDialect().sqlToQuery(calls.find((c) => c.op === "where")?.args[0] as SQL);

describe("relationshipRows", () => {
  it("reads each link from the member's own side, beside the other member", async () => {
    const { db } = queuedDb([
      [
        row({}),
        row({ id: "r2", kind: "romantic", type: "married", requesterId: "ada", userId: "kemi" }),
      ],
    ]);
    const items = await relationshipRows(db, storage, "sub", "viewer");
    expect(items).toEqual([
      {
        id: "r1",
        kind: "ds",
        type: "dominant",
        label: "submissive of",
        member: {
          userId: "dom",
          username: "tolu",
          displayName: "Tolu",
          avatarUrl: "https://media/avatars/dom/a.jpg?sm",
        },
        requestedBy: "self",
        createdAt: "2026-10-20T09:00:00.000Z",
        acceptedAt: "2026-10-21T09:00:00.000Z",
      },
      expect.objectContaining({ id: "r2", label: "Married to", requestedBy: "other" }),
    ]);
  });

  it("names the dominant's side to the dominant", async () => {
    const { db } = queuedDb([[row({ userId: "sub", username: "ada", avatarKey: null })]]);
    const [link] = await relationshipRows(db, storage, "dom", "dom");
    expect(link).toMatchObject({ label: "Dominant of", requestedBy: "other" });
    expect(link.member.avatarUrl).toBeNull();
  });

  it("leaves out suspended members and both sides of a block, the viewer's too", async () => {
    const own = queuedDb([[]]);
    await relationshipRows(own.db, storage, "u1", "u1");
    const other = queuedDb([[]]);
    await relationshipRows(other.db, storage, "u1", "viewer");
    const blockChecks = (sql: string) => sql.split('"member_block"').length - 1;
    expect(whereOf(own.calls).sql).toContain('"member_ban"');
    // Seen by someone else, their blocks count as well as the owner's.
    expect(blockChecks(whereOf(other.calls).sql)).toBeGreaterThan(
      blockChecks(whereOf(own.calls).sql),
    );
    expect(whereOf(other.calls).params).toContain("viewer");
  });
});

describe("profileRelationships", () => {
  it("shows only accepted links", async () => {
    const { db, calls } = queuedDb([[]]);
    await profileRelationships(db, storage, "u1", "viewer");
    const { sql, params } = whereOf(calls);
    expect(sql).toContain('"member_relationship"."status" =');
    expect(params).toContain("accepted");
  });
});
