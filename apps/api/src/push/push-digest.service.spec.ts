import { beforeEach, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { notification } from "../db/schema";
import { PushDigestService } from "./push-digest.service";

/**
 * Each `await` on the Drizzle chain takes the next queued answer and calls are
 * recorded; `transaction` runs its callback on the same chain.
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
        if (prop === "transaction") return (fn: (tx: unknown) => unknown) => fn(root);
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  const root: unknown = chain();
  const released = () =>
    calls
      .filter((c) => c.op === "where")
      .map((c) => new PgDialect().sqlToQuery(c.args[0] as never))
      .filter((q) => q.sql.includes('"notification"."id" in'))
      .flatMap((q) => q.params);
  return { db: root as never, calls, released };
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
  it("does nothing while another instance holds the lock", async () => {
    const { db } = queuedDb([{ rows: [{ locked: false }] }]);
    await expect(service(db).run(now)).resolves.toBe(0);
    expect(decide).not.toHaveBeenCalled();
  });

  it("sends one bundle for a member's held likes, says who, then releases them", async () => {
    const { db, released } = queuedDb([
      { rows: [{ locked: true }] },
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
      undefined,
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
    expect(released()).toEqual(["n1", "n2", "n3"]);
  });

  it("keeps waiting rows held when it's not yet time, but lets go of read and stale ones", async () => {
    decide.mockResolvedValue("hold");
    const { db, released } = queuedDb([
      { rows: [{ locked: true }] },
      [
        row({ id: "old", createdAt: ago(49 * 60) }),
        row({ id: "read", createdAt: ago(20), readAt: ago(5) }),
        row({ id: "live", createdAt: ago(10) }),
      ],
      undefined,
    ]);
    await expect(service(db).run(now)).resolves.toBe(0);
    expect(sendTo).not.toHaveBeenCalled();
    expect(released()).toEqual(["old", "read"]);
  });

  it("lets go without a push when the member turned the kind off since", async () => {
    decide.mockResolvedValue("drop");
    const { db, released } = queuedDb([
      { rows: [{ locked: true }] },
      [row({ id: "n1", createdAt: ago(10) })],
      undefined,
    ]);
    await service(db).run(now);
    expect(sendTo).not.toHaveBeenCalled();
    expect(released()).toEqual(["n1"]);
  });

  it("links a single held push straight to what it's about", async () => {
    const { db } = queuedDb([
      { rows: [{ locked: true }] },
      [row({ id: "n1", type: "comment", actorId: "a1", subjectId: "p9", createdAt: ago(300) })],
      [{ id: "a1", username: "ada", name: "Ada", displayName: "Ada" }],
      undefined,
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

it("releases rows by id (the query the release helper builds)", () => {
  const query = new PgDialect().sqlToQuery(inArray(notification.id, ["n1"]));
  expect(query.sql).toContain('"notification"."id" in');
});
