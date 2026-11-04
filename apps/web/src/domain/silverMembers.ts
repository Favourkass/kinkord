/** Everyone on Silver now, as admins see them (Moderation → Silver). */

/** subscription: paid; ring: a Kink Ring; both: rings stacked on paid time; given: by Kinkord. */
export type SilverSource = "subscription" | "ring" | "both" | "given" | "other";
export type SilverFilter = "all" | "subscription" | "ring" | "given";

export interface SilverMemberPM {
  id: string;
  username: string | null;
  displayName: string | null;
  source: SilverSource;
  until: string;
  forGood: boolean;
  plan: "monthly" | "yearly" | null;
}

export interface SilverMembersPM {
  counts: Record<SilverFilter, number>;
  items: SilverMemberPM[];
  nextPage: number | null;
}

export interface SilverMembersLabels {
  sources: Record<SilverSource, string>;
  plans: Record<"monthly" | "yearly", string>;
  until: (date: string) => string;
  forGood: string;
}

export interface SilverMemberVM {
  id: string;
  name: string;
  source: SilverSource;
  sourceLabel: string;
  detail: string;
  href: string;
}

/** "@tega (Tega)", or whichever of the two exists. */
function nameOf(m: SilverMemberPM): string {
  const handle = m.username ? `@${m.username}` : null;
  if (handle && m.displayName) return `${handle} (${m.displayName})`;
  return handle ?? m.displayName ?? m.id;
}

/** Each member's name, how they got Silver (and on which plan), and when it runs out. */
export function toSilverMemberVM(
  m: SilverMemberPM,
  labels: SilverMembersLabels,
  formatDate: (iso: string) => string,
  hrefFor: (id: string) => string,
): SilverMemberVM {
  const plan = m.plan && (m.source === "subscription" || m.source === "both");
  return {
    id: m.id,
    name: nameOf(m),
    source: m.source,
    sourceLabel: labels.sources[m.source] + (plan ? ` · ${labels.plans[m.plan!]}` : ""),
    detail: m.forGood ? labels.forGood : labels.until(formatDate(m.until)),
    href: hrefFor(m.id),
  };
}
