import { afterEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { postNotInterested, postSeen } from "../db/schema";
import { FeedFeedbackService } from "./feed-feedback.service";

/** Each `await` on the Drizzle chain takes the next queued answer; calls are recorded. */
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
  const arg = (op: string) => calls.find((c) => c.op === op)?.args[0];
  return { db: chain() as never, calls, arg };
}

const render = (s: unknown) => new PgDialect().sqlToQuery(s as SQL);
const A = "0f1c8b1e-1111-4111-8111-000000000001";
const B = "0f1c8b1e-1111-4111-8111-000000000002";
afterEach(() => vi.restoreAllMocks());

describe("FeedFeedbackService.seen", () => {
  it("counts each post the feed showed once more, from when it was first seen", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { db, calls, arg } = queuedDb([[{ id: A }, { id: B }], undefined]);
    await expect(new FeedFeedbackService(db).seen("u1", [A, B, A])).resolves.toEqual({ seen: 2 });
    expect(arg("insert")).toBe(postSeen);
    expect(arg("values")).toEqual([
      { userId: "u1", postId: A },
      { userId: "u1", postId: B },
    ]);
    const upsert = arg("onConflictDoUpdate") as { target: unknown[]; set: Record<string, SQL> };
    expect(upsert.target).toEqual([postSeen.userId, postSeen.postId]);
    expect(render(upsert.set.times).sql).toBe('"post_seen"."times" + 1');
    // The first sighting stays as it was.
    expect(Object.keys(upsert.set)).toEqual(["times", "lastSeenAt"]);
    expect(calls.some((c) => c.op === "delete")).toBe(false);
  });

  it("leaves out posts that are gone instead of failing the rest", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { db, calls } = queuedDb([[]]);
    await expect(new FeedFeedbackService(db).seen("u1", [A])).resolves.toEqual({ seen: 0 });
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("now and then clears what hasn't been seen for 30 days", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { db, calls } = queuedDb([[{ id: A }], undefined, undefined]);
    await new FeedFeedbackService(db).seen("u1", [A]);
    const del = calls.findIndex((c) => c.op === "delete");
    expect(calls[del].args[0]).toBe(postSeen);
    const where = render(calls.slice(del).find((c) => c.op === "where")!.args[0]);
    expect(where.sql).toContain('"post_seen"."last_seen_at" < now() - make_interval(days => $1)');
    expect(where.params).toEqual([30]);
  });
});

describe("FeedFeedbackService.notInterested", () => {
  it("keeps the post and its author for the member", async () => {
    const { db, arg } = queuedDb([[{ id: A, authorId: "ada", repostOfId: null }], undefined]);
    await expect(new FeedFeedbackService(db).notInterested("u1", A)).resolves.toEqual({
      postId: A,
    });
    expect(arg("insert")).toBe(postNotInterested);
    expect(arg("values")).toEqual({ userId: "u1", postId: A, authorId: "ada" });
  });

  it("counts a repost as the post it shows", async () => {
    const { db, arg } = queuedDb([
      [{ id: B, authorId: "bea", repostOfId: A }],
      [{ id: A, authorId: "ada" }],
      undefined,
    ]);
    await expect(new FeedFeedbackService(db).notInterested("u1", B)).resolves.toEqual({
      postId: A,
    });
    expect(arg("values")).toEqual({ userId: "u1", postId: A, authorId: "ada" });
  });

  it("refuses the member's own post, and a post that isn't there", async () => {
    const own = queuedDb([[{ id: A, authorId: "u1", repostOfId: null }]]);
    await expect(new FeedFeedbackService(own.db).notInterested("u1", A)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const gone = queuedDb([[]]);
    await expect(new FeedFeedbackService(gone.db).notInterested("u1", A)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("undoes it, for the post a repost shows", async () => {
    const { db, calls } = queuedDb([
      [{ id: B, authorId: "bea", repostOfId: A }],
      [{ id: A, authorId: "ada" }],
      undefined,
    ]);
    await expect(new FeedFeedbackService(db).undoNotInterested("u1", B)).resolves.toEqual({
      postId: A,
    });
    const del = calls.findIndex((c) => c.op === "delete");
    expect(calls[del].args[0]).toBe(postNotInterested);
    expect(render(calls.slice(del).find((c) => c.op === "where")!.args[0]).params).toEqual([
      "u1",
      A,
    ]);
  });
});
