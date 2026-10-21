import type { RelationshipKind } from "../db/schema";

/**
 * The D/s links a member can ask for (founder, 2026-10-21: "submissive of?
 * dom of?"): the submissive asks, naming the dominant's role, and the
 * dominant accepts. FetLife's pairs, cased the way kinksters write them.
 */
export const DS_TYPES = [
  { type: "dominant", dominant: "Dominant", submissive: "submissive" },
  { type: "domme", dominant: "Domme", submissive: "submissive" },
  { type: "master", dominant: "Master", submissive: "slave" },
  { type: "mistress", dominant: "Mistress", submissive: "slave" },
  { type: "owner", dominant: "Owner", submissive: "pet" },
  { type: "daddy", dominant: "Daddy", submissive: "little" },
  { type: "mommy", dominant: "Mommy", submissive: "little" },
  { type: "caregiver", dominant: "Caregiver", submissive: "little" },
  { type: "top", dominant: "Top", submissive: "bottom" },
  { type: "sadist", dominant: "Sadist", submissive: "masochist" },
  { type: "handler", dominant: "Handler", submissive: "pup" },
  { type: "brat_tamer", dominant: "Brat Tamer", submissive: "brat" },
] as const;

/** Every other relationship: either member asks, and it reads the same from both sides. */
export const ROMANTIC_TYPES = [
  { type: "partner", label: "Partner of" },
  { type: "married", label: "Married to" },
  { type: "engaged", label: "Engaged to" },
  { type: "dating", label: "Dating" },
  { type: "play_partner", label: "Play partner of" },
  { type: "fwb", label: "Friends with benefits with" },
] as const;

/** Which side of a link a member is on: a D/s link has two, any other one. */
export type RelationshipSide = "dominant" | "submissive" | "partner";

/** The kind a type belongs to, or null for one that isn't offered. */
export function relationshipKind(type: string): RelationshipKind | null {
  if (DS_TYPES.some((t) => t.type === type)) return "ds";
  if (ROMANTIC_TYPES.some((t) => t.type === type)) return "romantic";
  return null;
}

/**
 * How a link reads from one member's side, before the other's name:
 * "Dominant of", "submissive of", "Married to".
 */
export function relationshipLabel(type: string, side: RelationshipSide): string {
  const ds = DS_TYPES.find((t) => t.type === type);
  if (ds) return `${side === "submissive" ? ds.submissive : ds.dominant} of`;
  return ROMANTIC_TYPES.find((t) => t.type === type)?.label ?? "Linked with";
}

/** A member's side of a link: in a D/s link, whoever asked is the submissive. */
export function sideOf(
  link: { kind: RelationshipKind; requesterId: string },
  memberId: string,
): RelationshipSide {
  if (link.kind === "romantic") return "partner";
  return link.requesterId === memberId ? "submissive" : "dominant";
}

/** What the request form offers, display-ready. */
export function relationshipOptions() {
  return {
    ds: DS_TYPES.map((t) => ({ type: t.type, dominant: t.dominant, submissive: t.submissive })),
    romantic: ROMANTIC_TYPES.map((t) => ({ type: t.type, label: t.label })),
  };
}
