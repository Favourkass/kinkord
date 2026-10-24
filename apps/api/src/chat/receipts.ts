import { sql } from "drizzle-orm";

/** A client acknowledges received message IDs, never its own outgoing messages.
 * Scope every update to authenticated membership; old/retried acknowledgements cannot regress it.
 */
export function deliveryAckSql(userId: string, messageIds: readonly string[]) {
  return sql`update conversation_participant cp
    set last_delivered_at=greatest(cp.last_delivered_at, received.at)
    from (select m.conversation_id, max(m.created_at) as at from message m
      where m.id in (select value::uuid from jsonb_array_elements_text(${JSON.stringify(messageIds)}::jsonb)) and m.sender_id <> ${userId}
      and m.deleted_at is null group by m.conversation_id) received
    where cp.user_id=${userId} and cp.conversation_id=received.conversation_id
      and (cp.last_delivered_at is null or cp.last_delivered_at < received.at)
    returning cp.conversation_id`;
}
