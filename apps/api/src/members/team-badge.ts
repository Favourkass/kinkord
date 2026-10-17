import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { profile } from "../db/schema";

/** Only an explicit assignment counts; a subscription or admin role never does. */
export function teamBadge(userId: AnyPgColumn): SQL<boolean> {
  return sql<boolean>`exists (select 1 from ${profile} as team_profile where team_profile.user_id = ${userId} and team_profile.team_member = true)`;
}
