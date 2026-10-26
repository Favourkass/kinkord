import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { PushDigestService } from "./push-digest.service";

/**
 * Each `await` on the Drizzle chain takes the next queued answer and calls are
 * recorded.
 */
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
  const root: unknown = chain();
  /** Ids put back on hold: the `where` that follows each `set({ pushPending: true })`. */
  const heldAgain = () =>
    calls.flatMap((c, i) => {
      const value = c.args[0] as { pushPending?: boolean } | undefined;
      if (c.op !== "set" || value?.pushPending !== true) return [];
      const where = calls.slice(i + 1).find((n) => n.op === "where");
      return new PgDialect().sqlToQuery(where?.args[0] as never).params;
    });
  return { db: root as never, calls, heldAgain };
}

const now = new Date("2026-10-26T13:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const row = (over: Record<string, unknown>) => ({
  userId: "u1",
  type: "like",
  actorId: "a1",
  subjectId: "p1",
  readAt: null,
  ...over,
});
const sendTo = vi.fn(async () => 1);
const decide = vi.fn(async (): Promise<"send" | "hold" | "drop"> => "send");
const recordSent = vi.fn(async () => undefined);
const service = (db: never) =>
  new PushDigestService(db, { sendTo } as never, { decide, recordSent } as never);
beforeEach(() => {
  sendTo.mockClear().mockResolvedValue(1);
  decide.mockClear().mockResolvedValue("send");
  recordSent.mockClear();
});

describe("PushDigestService.run", () => {
  it("claims held rows in one statement that skips rows another instance is claiming", async () => {
    const { db, calls } = queuedDb([[]]);
    await expect(service(db).run(now)).resolves.toBe(0);
    expect(calls.find((c) => c.op === "for")?.args).toEqual(["update", { skipLocked: true }]);
    expect(calls.find((c) => c.op === "set")?.args[0]).toEqual({ pushPending: false });
    expect(decide).not.toHaveBeenCalled();
  });

  it("sends one bundle for a member's held likes, saying who", async () => {
    const { db, heldAgain } = queuedDb([
      [
        row({ id: "n1", actorId: "a1", subjectId: "p1", createdAt: ago(90) }),
        row({ id: "n2", actorId: "a2", subjectId: "p2", createdAt: ago(30) }),
        row({ id: "n3", actorId: "a3", subjectId: "p2", createdAt: ago(10) }),
      ],
      [
        { id: "a1", username: "ada", name: "Ada", displayName: "Ada" },
        { id: "a2", username: "tega", name: "Tega", displayName: null },
        { id: "a3", username: "kemi", name: "Kemi", displayName: "Kemi" },
      ],
    ]);
    await expect(service(db).run(now)).resolves.toBe(1);
    expect(decide).toHaveBeenCalledWith("u1", "like", now);
    expect(sendTo).toHaveBeenCalledWith("u1", {
      title: "Kinkord",
      body: "Kemi and 2 others liked your posts",
      url: "/notifications",
      tag: "digest-like",
    });
    expect(recordSent).toHaveBeenCalledWith("u1", "like");
    expect(heldAgain()).toEqual([]);
  });

  it("holds waiting rows again when it's not yet time, but lets go of read and stale ones", async () => {
    decide.mockResolvedValue("hold");
    const { db, heldAgain } = queuedDb([
      [
        row({ id: "old", createdAt: ago(49 * 60) }),
        row({ id: "read", createdAt: ago(20), readAt: ago(5) }),
        row({ id: "live", createdAt: ago(10) }),
      ],
      undefined,
    ]);
    await expect(service(db).run(now)).resolves.toBe(0);
    expect(sendTo).not.toHaveBeenCalled();
    expect(heldAgain()).toEqual(["live"]);
  });

  it("lets go without a push when the member turned the kind off since", async () => {
    decide.mockResolvedValue("drop");
    const { db, heldAgain } = queuedDb([[row({ id: "n1", createdAt: ago(10) })]]);
    await service(db).run(now);
    expect(sendTo).not.toHaveBeenCalled();
    expect(heldAgain()).toEqual([]);
  });

  it("asks nothing about a member whose held rows were all read or stale", async () => {
    const { db } = queuedDb([[row({ id: "read", createdAt: ago(20), readAt: ago(5) })]]);
    await service(db).run(now);
    expect(decide).not.toHaveBeenCalled();
  });

  it("links a single held push straight to what it's about", async () => {
    const { db } = queuedDb([
      [row({ id: "n1", type: "comment", actorId: "a1", subjectId: "p9", createdAt: ago(300) })],
      [{ id: "a1", username: "ada", name: "Ada", displayName: "Ada" }],
    ]);
    await service(db).run(now);
    expect(sendTo).toHaveBeenCalledWith("u1", {
      title: "Kinkord",
      body: "Ada commented on your post",
      url: "/p/p9",
      tag: "digest-comment",
      notificationId: "n1",
    });
  });
});
