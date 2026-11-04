import { and, eq, inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { memberBan, staff, user } from "../db/schema";

/**
 * The founders' accounts are admins by their email rather than by a row, so
 * admin access doesn't depend on a migration running after the account exists.
 * Being on this list means the moderation tools, Silver without paying (see
 * SubscriptionsService.silverUntil), no daily new-chat limit, a
 * push for every report, the moderation alert emails, and an account the admin
 * screens can't block or delete. The email must be verified: without that,
 * anyone could sign up with one of these addresses first and inherit all that.
 */
export const SUPER_ADMIN_EMAILS = [
  "maxihandsome@gmail.com",
  "nnabuekassidy@gmail.com",
  // Tega Maxwell, added 2026-10-02.
  "tegamaxwell2026@gmail.com",
];

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

/** SQL: the account is a founder's, a verified email on SUPER_ADMIN_EMAILS. */
export function founderAccount(u: { email: AnyColumn; emailVerified: AnyColumn }): SQL {
  return and(inArray(sql`lower(${u.email})`, SUPER_ADMIN_EMAILS), eq(u.emailVerified, true))!;
}

/**
 * Places on Meet the Team that come with an account, by its verified email,
 * the way admin access comes with a founder's. The API sets the badge and the
 * role every time it starts, the admin Team page doesn't list them, and no
 * admin screen can change or remove them (Favour, 2026-11-04).
 */
export const FIXED_TEAM_TITLES: Readonly<Record<string, string>> = {
  "nnabuekassidy@gmail.com": "Chief Software Engineer",
};

/** SQL: the account has a fixed place on Meet the Team. */
export function fixedTeamAccount(u: { email: AnyColumn; emailVerified: AnyColumn }): SQL {
  return and(
    inArray(sql`lower(${u.email})`, Object.keys(FIXED_TEAM_TITLES)),
    eq(u.emailVerified, true),
  )!;
}

/** The fixed role for this account, or null for anyone else. */
export function fixedTeamTitle(who: { email: string; emailVerified: boolean }): string | null {
  return (who.emailVerified && FIXED_TEAM_TITLES[who.email.trim().toLowerCase()]) || null;
}

/** The founders' accounts, with what isSuperAdmin needs. */
export function founderAccounts(db: Db): Promise<AdminCandidate[]> {
  return db
    .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(founderAccount(user));
}

/** Everyone who moderates: the founder's verified accounts, and anyone with a staff row. */
export async function adminUserIds(db: Db): Promise<string[]> {
  const founders = await founderAccounts(db);
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
