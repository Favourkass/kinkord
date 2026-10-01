import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { user } from "../db/schema";
import { blockedBy, notBlocking } from "./blocks";

const render = (q: Parameters<PgDialect["sqlToQuery"]>[0]) => new PgDialect().sqlToQuery(q);

describe("block filters", () => {
  it("notBlocking keeps rows whose member hasn't blocked the viewer", () => {
    expect(render(notBlocking(user.id, "u1"))).toMatchObject({
      sql: 'not exists (select 1 from "member_block" where "member_block"."blocker_id" = "user"."id" and "member_block"."blocked_id" = $1)',
      params: ["u1"],
    });
  });

  it("blockedBy asks whether the viewer blocked the row's member", () => {
    expect(render(blockedBy("u1", user.id))).toMatchObject({
      sql: 'exists (select 1 from "member_block" where "member_block"."blocker_id" = $1 and "member_block"."blocked_id" = "user"."id")',
      params: ["u1"],
    });
  });
});
