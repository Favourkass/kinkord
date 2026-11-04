/** Someone on Meet the Team, as the API sends them to anyone, signed in or not. */
export interface TeamMemberPM {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** What they do at Kinkord, in the founders' words. */
  title: string;
}

/** A card on Meet the Team. */
export interface TeamMemberVM {
  key: string;
  name: string;
  handle: string;
  title: string;
  avatarUrl: string | null;
  /** Shown in place of a photo they haven't added. */
  initial: string;
  href: string;
}

export function toTeamMemberVM(
  m: TeamMemberPM,
  hrefFor: (username: string) => string,
): TeamMemberVM {
  const handle = `@${m.username}`;
  const name = m.displayName.trim() || handle;
  return {
    key: m.username,
    name,
    handle,
    title: m.title,
    avatarUrl: m.avatarUrl,
    initial: name.replace(/^@/, "").charAt(0).toUpperCase(),
    href: hrefFor(m.username),
  };
}

/** A Kinkord Team member on the admin page, shown on Meet the Team or not. */
export interface TeamPageAdminMemberPM {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Null: they have the Kinkord Team badge but no role, so the page leaves them out. */
  title: string | null;
  blocked: boolean;
}

export interface TeamPageAdminPM {
  members: TeamPageAdminMemberPM[];
  canManage: boolean;
}

export interface TeamPageAdminLabels {
  /** Shown for a badge holder with no role yet. */
  noTitle: string;
  /** Shown for a blocked member, whatever their role. */
  blocked: string;
}

export interface TeamPageAdminRowVM {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  /** Their role, or why Meet the Team leaves them out. */
  title: string;
  shown: boolean;
  href: string;
  /** What "Change role" puts in the form. */
  username: string;
  currentTitle: string;
}

export function toTeamPageAdminRowVM(
  m: TeamPageAdminMemberPM,
  labels: TeamPageAdminLabels,
  hrefFor: (id: string) => string,
): TeamPageAdminRowVM {
  const handle = m.username ? `@${m.username}` : "";
  const shown = Boolean(m.title) && !m.blocked;
  return {
    id: m.id,
    name: m.displayName.trim() || handle,
    handle,
    avatarUrl: m.avatarUrl,
    title: m.blocked ? labels.blocked : (m.title ?? labels.noTitle),
    shown,
    href: hrefFor(m.id),
    username: m.username ?? "",
    currentTitle: m.title ?? "",
  };
}

/** The role as the API keeps it: one trimmed line. */
export function teamTitle(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
