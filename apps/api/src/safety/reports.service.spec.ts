import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { moderationLog, report } from "../db/schema";
import type { PushService } from "../push/push.service";
import type { StorageService } from "../storage/storage.service";
import type { BlocksService } from "./blocks.service";
import { EVIDENCE_MESSAGES, REPORTS_PER_DAY, ReportsService } from "./reports.service";

/**
 * A stand-in for the Drizzle client: every builder call returns the chain, and
 * each `await` takes the next queued answer, so a spec lists the database's
 * replies in the order the code asks.
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
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = calls.findIndex((c) => c.op === anchor && c.args[0] === table);
    return start < 0 ? undefined : calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: chain() as never, calls, after, left: () => queue.length };
}

function make(answers: unknown[]) {
  const q = queuedDb(answers);
  const storage = {
    presignDownload: vi.fn(
      async (key: string, variant?: string) => `https://media/${key}?${variant}`,
    ),
  };
  const blocks = { block: vi.fn(async () => undefined) };
  const push = { newReport: vi.fn() };
  return {
    ...q,
    service: new ReportsService(
      q.db,
      storage as unknown as StorageService,
      blocks as unknown as BlocksService,
      push as unknown as PushService,
    ),
    storage,
    blocks,
    push,
  };
}

const at = (minute: number) => new Date(`2026-10-01T12:${String(minute).padStart(2, "0")}:00.000Z`);
const msg = (id: string, senderId: string, minute: number, over: Record<string, unknown> = {}) => ({
  id,
  conversationId: "11111111-1111-4111-8111-111111111111",
  senderId,
  body: `message ${id}`,
  photoKey: null,
  createdAt: at(minute),
  editedAt: null,
  deletedAt: null,
  ...over,
});
const CONV = "11111111-1111-4111-8111-111111111111";

describe("ReportsService.create", () => {
  it("won't let a member report themselves", async () => {
    const { service } = make([]);
    await expect(
      service.create("u1", { userId: "u1", reason: "spam", block: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("is a 404 for a member who doesn't exist", async () => {
    const { service } = make([[]]);
    await expect(
      service.create("u1", { userId: "u9", reason: "spam", block: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("caps how many reports one member can make in a day", async () => {
    const { service, push } = make([[{ id: "u2" }], [{ n: REPORTS_PER_DAY }]]);
    const err = await service
      .create("u1", { userId: "u2", reason: "spam", block: false })
      .catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(push.newReport).not.toHaveBeenCalled();
  });

  it("keeps the thread's last messages, oldest first, and tells the moderators", async () => {
    const { service, after, push, blocks } = make([
      [{ id: "u2" }],
      [{ n: 0 }],
      [{ userId: "u1" }, { userId: "u2" }], // both are in the thread
      // The database answers newest first.
      [
        msg("m3", "u2", 3, { body: null, photoKey: "chat/c/u2/p.jpg" }),
        msg("m2", "u1", 2),
        msg("m1", "u2", 1),
      ],
      [{ id: "r1" }],
    ]);
    await expect(
      service.create("u1", {
        userId: "u2",
        conversationId: CONV,
        reason: "unwanted_sexual",
        details: "",
        block: false,
      }),
    ).resolves.toEqual({ id: "r1" });
    expect(after("insert", report, "values")).toEqual({
      reporterId: "u1",
      reportedUserId: "u2",
      conversationId: CONV,
      reason: "unwanted_sexual",
      details: null,
      evidence: [
        {
          id: "m1",
          senderId: "u2",
          body: "message m1",
          photoKey: null,
          createdAt: at(1).toISOString(),
        },
        {
          id: "m2",
          senderId: "u1",
          body: "message m2",
          photoKey: null,
          createdAt: at(2).toISOString(),
        },
        {
          id: "m3",
          senderId: "u2",
          body: null,
          photoKey: "chat/c/u2/p.jpg",
          createdAt: at(3).toISOString(),
        },
      ],
    });
    expect(push.newReport).toHaveBeenCalledTimes(1);
    expect(blocks.block).not.toHaveBeenCalled();
  });

  it("only takes as much of the thread as the evidence limit", async () => {
    const { service, calls } = make([
      [{ id: "u2" }],
      [{ n: 0 }],
      [{ userId: "u1" }, { userId: "u2" }],
      [],
      [{ id: "r1" }],
    ]);
    await service.create("u1", {
      userId: "u2",
      conversationId: CONV,
      reason: "spam",
      block: false,
    });
    const limits = calls.filter((c) => c.op === "limit").map((c) => c.args[0]);
    expect(limits).toContain(EVIDENCE_MESSAGES);
  });

  it("won't attach a thread the two members aren't both in", async () => {
    const { service, calls } = make([[{ id: "u2" }], [{ n: 0 }], [{ userId: "u1" }]]);
    await expect(
      service.create("u1", { userId: "u2", conversationId: CONV, reason: "spam", block: false }),
    ).rejects.toThrow("Conversation not found.");
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("blocks them in the same step when asked", async () => {
    const { service, blocks } = make([[{ id: "u2" }], [{ n: 0 }], [{ id: "r1" }]]);
    await service.create("u1", {
      userId: "u2",
      reason: "harassment",
      details: "keeps messaging",
      block: true,
    });
    expect(blocks.block).toHaveBeenCalledWith("u1", "u2");
  });
});

describe("ReportsService.list", () => {
  const stored = {
    id: "r1",
    reporterId: "u1",
    reportedUserId: "u2",
    conversationId: CONV,
    reason: "underage",
    details: "says they're 16",
    evidence: [
      { id: "m1", senderId: "u2", body: "hey", photoKey: null, createdAt: at(1).toISOString() },
      {
        id: "m2",
        senderId: "u2",
        body: null,
        photoKey: "chat/c/u2/p.jpg",
        createdAt: at(2).toISOString(),
      },
      {
        id: "m3",
        senderId: "u1",
        body: "how old are you?",
        photoKey: null,
        createdAt: at(3).toISOString(),
      },
    ],
    status: "open",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: at(5),
  };

  it("names both members and links the photos in the evidence", async () => {
    const { service } = make([
      [
        {
          report: stored,
          reporterId: "u1",
          reporterUsername: "favour",
          reporterName: "Favour",
          reporterDisplayName: null,
          reportedId: "u2",
          reportedUsername: "ada",
          reportedName: "Adaeze Obi",
          reportedDisplayName: "Ada",
        },
      ],
    ]);
    const [r] = await service.list("open");
    expect(r).toMatchObject({
      id: "r1",
      reason: "underage",
      reporter: { userId: "u1", username: "favour", displayName: "favour" },
      reported: { userId: "u2", username: "ada", displayName: "Ada" },
    });
    expect(
      r.evidence.map((e) => [e.id, e.fromReported, e.body, e.photo?.thumbUrl ?? null]),
    ).toEqual([
      ["m1", true, "hey", null],
      ["m2", true, "", "https://media/chat/c/u2/p.jpg?md"],
      ["m3", false, "how old are you?", null],
    ]);
  });

  it("keeps a report whose accounts are gone, without names", async () => {
    const { service } = make([
      [
        {
          report: { ...stored, evidence: [] },
          reporterId: null,
          reporterUsername: null,
          reporterName: null,
          reporterDisplayName: null,
          reportedId: null,
          reportedUsername: null,
          reportedName: null,
          reportedDisplayName: null,
        },
      ],
    ]);
    const [r] = await service.list("open");
    expect(r).toMatchObject({ reporter: null, reported: null, reportedUserId: "u2" });
  });

  it("reads open reports most serious first, and closed ones newest first", async () => {
    const open = make([[]]);
    await open.service.list("open");
    const openOrder = open.calls.find((c) => c.op === "orderBy")?.args ?? [];
    expect(openOrder).toHaveLength(2);
    const closed = make([[]]);
    await closed.service.list("resolved");
    expect(closed.calls.find((c) => c.op === "orderBy")?.args).toHaveLength(1);
  });
});

describe("ReportsService.resolve", () => {
  it("closes the report and records who did it in the moderation log", async () => {
    const { service, after } = make([[{ id: "r1", reportedUserId: "u2" }], undefined]);
    await expect(service.resolve("a1", "r1", "dismissed")).resolves.toEqual({
      id: "r1",
      status: "dismissed",
    });
    expect(after("update", report, "set")).toMatchObject({ status: "dismissed", reviewedBy: "a1" });
    expect(after("insert", moderationLog, "values")).toEqual({
      actorId: "a1",
      action: "report_dismissed",
      subjectUserId: "u2",
      detail: "r1",
    });
  });

  it("is a 404 for a report that doesn't exist", async () => {
    const { service } = make([[]]);
    await expect(service.resolve("a1", "r9", "resolved")).rejects.toBeInstanceOf(NotFoundException);
  });
});
