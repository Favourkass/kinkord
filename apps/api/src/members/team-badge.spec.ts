import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { user } from "../db/schema";
import { teamBadge } from "./team-badge";
describe("teamBadge", () => {
  it("requires an explicit team flag, never a paid plan or staff role", () => {
    const q = new PgDialect().sqlToQuery(teamBadge(user.id));
    expect(q.sql).toContain("team_profile.team_member = true");
    expect(q.sql).not.toContain("staff");
    expect(q.sql).not.toContain("subscription");
  });
});
