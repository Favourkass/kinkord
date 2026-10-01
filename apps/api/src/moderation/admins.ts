import { and, eq, inArray, sql, type AnyColumn } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { memberBan, staff, user } from "../db/schema";

/**
 * The founder's accounts are admins by their email rather than by a row, so
 * admin access doesn't depend on a migration running after the account exists.
 * The email must be verified: without that, anyone could sign up with this
 * address before the founder does and inherit the admin tools.
 */
export const SUPER_ADMIN_EMAILS = ["maxihandsome@gmail.com", "nnabuekassidy@gmail.com"];

export interface AdminCandidate {
  id: string;
  email: string;
  emailVerified: boolean;
}

export function isSuperAdmin(who: Pick<AdminCandidate, "email" | "emailVerified">): boolean {
  return who.emailVerified && SUPER_ADMIN_EMAILS.includes(who.email.trim().toLowerCase());
}

export async function isAdmin(db: Db, who: AdminCandidate): Promise<boolean> {
  if (isSuperAdmin(who)) return true;
  const [row] = await db
    .select({ userId: staff.userId })
    .from(staff)
    .where(eq(staff.userId, who.id))
    .limit(1);
  return Boolean(row);
}

/** Everyone who moderates: the founder's verified accounts, and anyone with a staff row. */
export async function adminUserIds(db: Db): Promise<string[]> {
  const founders = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(inArray(sql`lower(${user.email})`, SUPER_ADMIN_EMAILS), eq(user.emailVerified, true)),
    );
  const team = await db.select({ id: staff.userId }).from(staff);
  return [...new Set([...founders, ...team].map((r) => r.id))];
}

export async function isBanned(db: Db, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: memberBan.userId })
    .from(memberBan)
    .where(eq(memberBan.userId, userId))
    .limit(1);
  return Boolean(row);
}

/** Shown when a suspended member tries to sign in. */
export const ACCOUNT_SUSPENDED = "This account has been suspended.";

/**
 * True for rows whose member isn't suspended. Suspended members disappear from
 * the directory, their profile and every feed, so a block reads as gone rather
 * than as someone who simply stopped replying.
 */
export function notBanned(userId: AnyColumn) {
  return sql`not exists (select 1 from ${memberBan} where ${memberBan.userId} = ${userId})`;
}
