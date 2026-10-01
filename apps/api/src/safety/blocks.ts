import { sql, type AnyColumn } from "drizzle-orm";
import { memberBlock } from "../db/schema";

/**
 * True for rows whose member hasn't blocked `viewerId`. To the member they
 * blocked, a blocker reads as gone, the way a suspended member does (see
 * notBanned): no thread in their inbox, nobody to message.
 */
export function notBlocking(userId: AnyColumn, viewerId: string) {
  return sql`not exists (select 1 from ${memberBlock} where ${memberBlock.blockerId} = ${userId} and ${memberBlock.blockedId} = ${viewerId})`;
}

/** Whether `viewerId` has blocked the row's member: their thread stays, read-only. */
export function blockedBy(viewerId: string, userId: AnyColumn) {
  return sql<boolean>`exists (select 1 from ${memberBlock} where ${memberBlock.blockerId} = ${viewerId} and ${memberBlock.blockedId} = ${userId})`;
}
