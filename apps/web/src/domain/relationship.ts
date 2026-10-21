/**
 * Linked relationships between members' profiles, FetLife-style. In a D/s
 * link the submissive asks and the dominant accepts; any other relationship
 * either member asks for. The API reads each link from the member's own side
 * ("submissive of", "Dominant of", "Married to"), so the label is display-ready.
 */
export type RelationshipKind = "ds" | "romantic";

export interface RelationshipMemberPM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
}

/** A link or a request, from one member's side. */
export interface RelationshipPM {
  id: string;
  kind: RelationshipKind;
  type: string;
  label: string;
  member: RelationshipMemberPM;
  requestedBy: "self" | "other";
  createdAt: string;
  acceptedAt: string | null;
}

/** GET /relationships: your links, and the requests waiting either way. */
export interface RelationshipsPM {
  links: RelationshipPM[];
  incoming: RelationshipPM[];
  outgoing: RelationshipPM[];
}

/** GET /relationships/options. */
export interface RelationshipOptionsPM {
  ds: { type: string; dominant: string; submissive: string }[];
  romantic: { type: string; label: string }[];
}

/** One linked member on a profile or the Relationships screen. */
export interface RelationshipRowVM {
  id: string;
  /** "submissive of" */
  label: string;
  name: string;
  avatarUrl: string | null;
  href: string | null;
}

export function toRelationshipRowVM(
  pm: RelationshipPM,
  memberHref: (username: string) => string,
): RelationshipRowVM {
  return {
    id: pm.id,
    label: pm.label,
    name: pm.member.displayName,
    avatarUrl: pm.member.avatarUrl,
    href: pm.member.username ? memberHref(pm.member.username) : null,
  };
}

/** The profile's Relationships card, display-ready. */
export interface RelationshipsCardVM {
  title: string;
  rows: RelationshipRowVM[];
  /** On your own profile with no links yet. */
  empty: string | null;
  /** Your own profile: to the Relationships screen. */
  manage: { href: string; label: string } | null;
  /** Someone else's profile: the request form, ready for them. */
  link: { href: string; label: string } | null;
}

export interface RelationshipChoiceVM {
  value: string;
  label: string;
}

/**
 * The request form's choices, each saying what you'd be to them. A D/s
 * choice always makes you the submissive: the dominant accepts.
 */
export function relationshipChoices(
  options: RelationshipOptionsPM,
  labels: {
    ds: (o: { dominant: string; submissive: string }) => string;
    romantic: (o: { label: string }) => string;
  },
): { ds: RelationshipChoiceVM[]; romantic: RelationshipChoiceVM[] } {
  return {
    ds: options.ds.map((o) => ({ value: o.type, label: labels.ds(o) })),
    romantic: options.romantic.map((o) => ({ value: o.type, label: labels.romantic(o) })),
  };
}
