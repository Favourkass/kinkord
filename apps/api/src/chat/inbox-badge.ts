import { sql } from "drizzle-orm";

/**
 * New incoming messages since inbox entry, independent of thread unread totals.
 * Keep these SQL identifiers qualified: Drizzle unqualifies Column objects in
 * a single-table SELECT projection, including those inside a scalar subquery.
 * Only values supplied by the caller are interpolated and parameterized.
 */
export function messageBadgeCount(userId: string) {
  return sql<number>`(select count(*) from "message"
    inner join "conversation_participant" on "conversation_participant"."conversation_id" = "message"."conversation_id"
      and "conversation_participant"."user_id" = ${userId}
    where "message"."deleted_at" is null and "message"."sender_id" <> ${userId}
      and not exists (select 1 from "member_ban" where "member_ban"."user_id" = "message"."sender_id")
      and not exists (select 1 from "member_block" where "member_block"."blocker_id" = "message"."sender_id"
        and "member_block"."blocked_id" = ${userId})
      and "message"."created_at" > coalesce("conversation_participant"."last_read_at", 'epoch')
      and "message"."created_at" > coalesce((select "chat_inbox_seen"."seen_at" from "chat_inbox_seen"
        where "chat_inbox_seen"."user_id" = ${userId}), 'epoch'))`;
}
