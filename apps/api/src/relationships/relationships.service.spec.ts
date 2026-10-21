import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memberRelationship } from "../db/schema";
import type { RelationshipItem } from "./profile-relationships";
import { MAX_PENDING_REQUESTS, RelationshipsService } from "./relationships.service";

const rows = vi.fn();
vi.mock("./profile-relationships", () => ({
  relationshipRows: (...a: unknown[]) => rows(...a),
}));

/** Each `await` takes the next queued answer; the calls are kept to check what was written. */
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
  const push = { relationshipRequest: vi.fn(), relationshipAccepted: vi.fn() };
  const service = new RelationshipsService(q.db, push as never, {} as never);
  return { ...q, service, push };
}

const item = (over: Partial<RelationshipItem>): RelationshipItem => ({
  id: "r1",
  kind: "ds",
  type: "dominant",
  label: "submissive of",
  member: { userId: "u2", username: "tolu", displayName: "Tolu", avatarUrl: null },
  requestedBy: "self",
  createdAt: "2026-10-21T09:00:00.000Z",
  acceptedAt: null,
  ...over,
});

const sqlOf = (where: unknown) => new PgDialect().sqlToQuery(where as SQL);

beforeEach(() => {
  rows.mockReset().mockResolvedValue([]);
});

describe("RelationshipsService.list", () => {
  it("splits links from the requests waiting each way", async () => {
    rows.mockResolvedValue([
      item({ id: "link", acceptedAt: "2026-10-21T10:00:00.000Z" }),
      item({ id: "in", requestedBy: "other" }),
      item({ id: "out" }),
    ]);
    const { service } = make([]);
    const list = await service.list("u1");
    expect([list.links, list.incoming, list.outgoing].map((l) => l.map((i) => i.id))).toEqual([
      ["link"],
      ["in"],
      ["out"],
    ]);
    expect(rows).toHaveBeenCalledWith(expect.anything(), expect.anything(), "u1", "u1");
  });
});

describe("RelationshipsService.request", () => {
  it("refuses a relationship that isn't offered, before looking anyone up", async () => {
    const { service, calls } = make([]);
    await expect(service.request("u1", "tolu", "boss")).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toHaveLength(0);
  });

  it("is a 404 for a username nobody has, or a member blocked either way or suspended", async () => {
    const { service } = make([[]]);
    await expect(service.request("u1", "@Nobody", "dominant")).rejects.toThrow(
      new NotFoundException("No member has the username @nobody."),
    );
  });

  it("won't link a member with themselves", async () => {
    const { service } = make([[{ id: "u1" }]]);
    await expect(service.request("u1", "me", "partner")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("never links an organization's account", async () => {
    const { service, calls } = make([[{ id: "org", accountType: "organization" }]]);
    await expect(service.request("u1", "kinkord", "partner")).rejects.toThrow(
      "Relationships link people, not organizations.",
    );
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it(`stops at ${MAX_PENDING_REQUESTS} requests waiting`, async () => {
    const { service, push } = make([[{ id: "u2" }], [{ n: MAX_PENDING_REQUESTS }]]);
    const refused = service.request("u1", "tolu", "dominant");
    await expect(refused).rejects.toBeInstanceOf(HttpException);
    await expect(refused).rejects.toMatchObject({ status: 429 });
    expect(push.relationshipRequest).not.toHaveBeenCalled();
  });

  it("allows one D/s link per pair, whoever asked first", async () => {
    const { service, push } = make([[{ id: "u2" }], [{ n: 0 }], []]);
    await expect(service.request("u1", "tolu", "master")).rejects.toThrow(
      new ConflictException("You and @tolu already have a D/s link, or a request waiting."),
    );
    expect(push.relationshipRequest).not.toHaveBeenCalled();
  });

  it("says which kind is taken for any other relationship", async () => {
    const { service } = make([[{ id: "u2" }], [{ n: 0 }], []]);
    await expect(service.request("u1", "tolu", "married")).rejects.toThrow(
      "You and @tolu already have a relationship link, or a request waiting.",
    );
  });

  it("records the asker as the submissive, the pair in order, and tells the other member", async () => {
    const { service, after, push, left } = make([[{ id: "u2" }], [{ n: 3 }], [{ id: "r9" }]]);
    rows.mockResolvedValue([item({ id: "r9" })]);
    const list = await service.request("u9", "tolu", "dominant");
    expect(after("insert", memberRelationship, "values")).toEqual({
      userA: "u2",
      userB: "u9",
      requesterId: "u9",
      kind: "ds",
      type: "dominant",
    });
    expect(push.relationshipRequest).toHaveBeenCalledWith("u9", "u2", "r9");
    expect(list.outgoing.map((i) => i.id)).toEqual(["r9"]);
    expect(left()).toBe(0);
  });
});

describe("RelationshipsService.accept", () => {
  it("lets only the member who was asked accept, and tells the asker", async () => {
    const { service, calls, push } = make([[{ requesterId: "u2" }]]);
    await service.accept("u1", "r1");
    const where = calls.find((c) => c.op === "where")?.args[0];
    const { sql, params } = sqlOf(where);
    expect(sql).toContain('"member_relationship"."requester_id" <>');
    expect(sql).toContain('"member_relationship"."status" =');
    expect(params).toEqual(expect.arrayContaining(["r1", "pending", "u1"]));
    expect(push.relationshipAccepted).toHaveBeenCalledWith("u1", "u2", "r1");
  });

  it("says when the request is no longer waiting", async () => {
    const { service, push } = make([[]]);
    await expect(service.accept("u1", "r1")).rejects.toBeInstanceOf(NotFoundException);
    expect(push.relationshipAccepted).not.toHaveBeenCalled();
  });
});

describe("RelationshipsService.remove", () => {
  it("lets either member end a link or drop a request, and tells nobody", async () => {
    const { service, push, after } = make([[{ id: "r1" }]]);
    await service.remove("u2", "r1");
    const { params } = sqlOf(after("delete", memberRelationship, "where"));
    expect(params).toEqual(["r1", "u2", "u2"]);
    expect(push.relationshipRequest).not.toHaveBeenCalled();
    expect(push.relationshipAccepted).not.toHaveBeenCalled();
  });

  it("says when it's already gone", async () => {
    const { service } = make([[]]);
    await expect(service.remove("u1", "r1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
