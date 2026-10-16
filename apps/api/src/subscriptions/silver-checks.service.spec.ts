import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { memberSubscription, moderationLog } from "../db/schema";
import type { PushService } from "../push/push.service";
import type { StorageService } from "../storage/storage.service";
import { SilverChecksService } from "./silver-checks.service";

/** Each `await` takes the next queued answer (an Error is thrown). */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            value instanceof Error ? reject(value) : resolve(value);
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
  return { db: chain() as never, after, left: () => queue.length };
}

function make(answers: unknown[]) {
  const q = queuedDb(answers);
  const push = { silverCheckReview: vi.fn() };
  const storage = { presignDownload: vi.fn(async (k: string) => `https://media/${k}`) };
  const service = new SilverChecksService(
    q.db,
    storage as unknown as StorageService,
    push as unknown as PushService,
  );
  return { ...q, service, push };
}

describe("SilverChecksService.hold", () => {
  it("hides a Silver member's check and tells the admins", async () => {
    const { service, after, push } = make([[{ userId: "u1" }]]);
    await expect(service.hold("u1", "name")).resolves.toBe(true);
    expect(after("update", memberSubscription, "set")).toMatchObject({ checkHoldReason: "name" });
    expect(push.silverCheckReview).toHaveBeenCalledOnce();
  });

  it("does nothing for a member without Silver", async () => {
    const { service, push } = make([[]]);
    await expect(service.hold("u1", "photo")).resolves.toBe(false);
    expect(push.silverCheckReview).not.toHaveBeenCalled();
  });

  it("never fails the profile change that caused it", async () => {
    const { service } = make([new Error("connection lost")]);
    await expect(service.hold("u1", "username")).resolves.toBe(false);
  });
});

describe("SilverChecksService.held", () => {
  it("lists checks waiting for review with what changed", async () => {
    const heldAt = new Date("2026-10-07T09:00:00Z");
    const until = new Date("2027-10-06T12:00:00Z");
    const { service } = make([
      [
        {
          userId: "u1",
          heldAt,
          reason: "name",
          until,
          username: "ada",
          name: "Ada",
          displayName: "Ada O",
          avatarKey: "avatars/u1/a.jpg",
        },
      ],
    ]);
    await expect(service.held()).resolves.toEqual([
      {
        userId: "u1",
        username: "ada",
        displayName: "Ada O",
        avatarUrl: "https://media/avatars/u1/a.jpg",
        reason: "name",
        heldAt: "2026-10-07T09:00:00.000Z",
        silverUntil: "2027-10-06T12:00:00.000Z",
      },
    ]);
  });
});

describe("SilverChecksService.forMember", () => {
  it("is null without Silver, and the check's state with it", async () => {
    await expect(make([[]]).service.forMember("u1")).resolves.toBeNull();
    const until = new Date("2027-10-06T12:00:00Z");
    const { service } = make([
      [{ until }],
      [
        {
          heldAt: new Date(),
          heldFor: "photo",
          avatarKey: "a",
          coverKey: "c",
        },
      ],
    ]);
    await expect(service.forMember("u1")).resolves.toEqual({
      silverUntil: "2027-10-06T12:00:00.000Z",
      shown: false,
      reason: "held",
      heldFor: "photo",
    });
  });
});

describe("SilverChecksService decisions", () => {
  it("approves a held check and logs it", async () => {
    const { service, after } = make([[{ userId: "u1" }], undefined]);
    await expect(service.approve("a1", "u1")).resolves.toEqual({ userId: "u1" });
    expect(after("update", memberSubscription, "set")).toEqual({
      checkHeldAt: null,
      checkHoldReason: null,
    });
    expect(after("insert", moderationLog, "values")).toEqual({
      actorId: "a1",
      action: "silver_check_approved",
      subjectUserId: "u1",
    });
  });

  it("won't approve a check that isn't waiting", async () => {
    await expect(make([[]]).service.approve("a1", "u1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("removes a check with a reason for the log", async () => {
    const { service, after } = make([[{ userId: "u1" }], undefined]);
    await service.remove("a1", "u1", "Impersonating another member");
    expect(after("update", memberSubscription, "set")).toMatchObject({ checkHoldReason: "admin" });
    expect(after("insert", moderationLog, "values")).toEqual({
      actorId: "a1",
      action: "silver_check_removed",
      subjectUserId: "u1",
      detail: "Impersonating another member",
    });
  });

  it("can't remove a check from someone without Silver", async () => {
    await expect(make([[]]).service.remove("a1", "u1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
