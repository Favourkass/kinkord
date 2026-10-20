import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { messageBadgeCount } from "./inbox-badge";

describe("messageBadgeCount", () => {
  const { sql, params } = new PgDialect().sqlToQuery(messageBadgeCount("u1"));

  it("counts unread incoming messages newer than the member last opened their inbox", () => {
    expect(sql).toContain('"message"."sender_id" <> $');
    expect(sql).toContain('coalesce("conversation_participant"."last_read_at", \'epoch\')');
    expect(sql).toContain('from "chat_inbox_seen"');
  });

  it("leaves out suspended senders and anyone who blocked the member", () => {
    expect(sql).toContain('from "member_ban"');
    expect(sql).toContain('"member_block"."blocker_id" = "message"."sender_id"');
  });

  it("only ever puts the member's id in as a parameter", () => {
    expect(params).toEqual(["u1", "u1", "u1", "u1"]);
    expect(sql).not.toContain("u1");
  });
});
