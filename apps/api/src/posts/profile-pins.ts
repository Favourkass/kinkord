import { BadRequestException } from "@nestjs/common";
import { getTableName, sql, type AnyColumn } from "drizzle-orm";
import { z } from "zod";
import { post } from "../db/schema";
import { privacyAllows } from "../privacy/privacy-policy";

function column(column: AnyColumn) {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}

/** One pin per author, stored separately from ordinary feed ordering. */
export function profilePostPinned(postId: AnyColumn) {
  return sql<boolean>`exists (select 1 from profile_post_pin where post_id=${column(postId)})`;
}

/** Pinning never bypasses the post audience or the reciprocal pinned-post audience. */
export function pinnedPostAllows(viewerId: string, authorId: AnyColumn, postId: AnyColumn) {
  return sql<boolean>`(not ${profilePostPinned(postId)} or ${privacyAllows(viewerId, authorId, "pinnedPosts")})`;
}

// JS Date preserves milliseconds. Order and paginate at the same precision, with id as tie-breaker.
export const profilePostTime = sql`date_trunc('milliseconds', ${post.createdAt})`;
const cursorSchema = z
  .object({
    pinned: z.boolean(),
    at: z.string().datetime(),
    id: z.string().uuid(),
  })
  .strict();
export type ProfilePostCursor = z.infer<typeof cursorSchema>;

export function profilePostCursor(row: { id: string; createdAt: Date; isPinned: boolean }) {
  return `profile:${Buffer.from(JSON.stringify({ pinned: Boolean(row.isPinned), at: row.createdAt.toISOString(), id: row.id })).toString("base64url")}`;
}

export function parseProfilePostCursor(value?: string | null): ProfilePostCursor | null {
  if (!value) return null;
  try {
    if (!value.startsWith("profile:") || value.length > 512) throw new Error();
    return cursorSchema.parse(JSON.parse(Buffer.from(value.slice(8), "base64url").toString()));
  } catch {
    throw new BadRequestException("Invalid profile cursor. Refresh the profile to try again.");
  }
}

export function afterProfilePost(cursor: ProfilePostCursor) {
  return sql`(${profilePostPinned(post.id)}, ${profilePostTime}, ${post.id}) < (${cursor.pinned}::boolean, ${cursor.at}::timestamptz, ${cursor.id}::uuid)`;
}
