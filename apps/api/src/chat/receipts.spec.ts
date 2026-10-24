import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { deliveryAckSql } from "./receipts";
import { deliverySchema } from "./dto";

describe("delivery acknowledgements", () => {
  it("binds identity and IDs, limits updates to the authenticated recipient, and never updates read state", () => {
    const query = new PgDialect().sqlToQuery(deliveryAckSql("viewer", ["one"]));
    expect(query.params).toContain("viewer");
    expect(query.sql).toContain("cp.user_id=");
    expect(query.sql).toContain("m.sender_id <>");
    expect(query.sql).toContain("greatest(cp.last_delivered_at, received.at)");
    expect(query.sql).not.toContain("last_read");
  });
  it("rejects malformed IDs, oversized batches and impersonation", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(deliverySchema.safeParse({ messageIds: [id] }).success).toBe(true);
    for (const body of [
      { messageIds: [] },
      { messageIds: ["bad"] },
      { messageIds: Array(101).fill(id) },
      { messageIds: [id], userId: "other" },
    ])
      expect(deliverySchema.safeParse(body).success).toBe(false);
  });
});
