import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { memberBlock } from "../db/schema";
import { BlocksService } from "./blocks.service";

/** A select that answers `found`, plus an insert and a delete that record what they were given. */
function make(found: unknown[]) {
  const limit = vi.fn(async () => found);
  const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) }));
  const onConflictDoNothing = vi.fn(async () => undefined);
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn(async (_w: SQL) => undefined);
  const del = vi.fn(() => ({ where }));
  const db = { select, insert, delete: del } as never;
  return {
    service: new BlocksService(db),
    select,
    insert,
    values,
    onConflictDoNothing,
    del,
    where,
  };
}

describe("BlocksService", () => {
  it("won't let a member block themselves", async () => {
    const { service, select } = make([]);
    await expect(service.block("u1", "u1")).rejects.toBeInstanceOf(BadRequestException);
    expect(select).not.toHaveBeenCalled();
  });

  it("is a 404 for a member who doesn't exist", async () => {
    const { service, insert } = make([]);
    await expect(service.block("u1", "u9")).rejects.toBeInstanceOf(NotFoundException);
    expect(insert).not.toHaveBeenCalled();
  });

  it("records the block once, however many times it's asked for", async () => {
    const { service, insert, values, onConflictDoNothing } = make([{ id: "u2" }]);
    await service.block("u1", "u2");
    expect(insert).toHaveBeenCalledWith(memberBlock);
    expect(values).toHaveBeenCalledWith({ blockerId: "u1", blockedId: "u2" });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it("lifts only the member's own block", async () => {
    const { service, del, where } = make([]);
    await service.unblock("u1", "u2");
    expect(del).toHaveBeenCalledWith(memberBlock);
    expect(new PgDialect().sqlToQuery(where.mock.calls[0][0])).toMatchObject({
      sql: '("member_block"."blocker_id" = $1 and "member_block"."blocked_id" = $2)',
      params: ["u1", "u2"],
    });
  });
});
