/** Relationships screen and profile card (founder, 2026-10-21: FetLife-style links). */
export const RELATIONSHIPS_COPY = {
  title: "Relationships",
  intro:
    "Link your D/s dynamics and relationships to each other's profiles. A link shows once both of you agree, and either of you can end it at any time.",
  form: {
    title: "Link a relationship",
    username: "Their username",
    usernamePlaceholder: "@username",
    type: "What are you to them?",
    typePlaceholder: "Choose…",
    dsGroup: "D/s: you're the submissive, they accept as your dominant",
    romanticGroup: "Relationship: either of you can ask",
    ds: (o: { dominant: string; submissive: string }) =>
      `${o.submissive} of them (they're your ${o.dominant})`,
    romantic: (o: { label: string }) => `${o.label} them`,
    send: "Send request",
    sending: "Sending…",
    invalid: "Enter their username and choose what you are to them.",
    sent: (handle: string) => `Request sent to @${handle}. It shows once they accept.`,
  },
  incoming: "Waiting for you",
  outgoing: "Waiting for them",
  links: "Your links",
  noLinks: "No linked relationships yet.",
  /** What accepting would make you: "You'd be Dominant of Ada". */
  incomingLine: (label: string, name: string) => `You'd be ${label} ${name}`,
  outgoingLine: (label: string, name: string) => `You'd be ${label} ${name}`,
  accept: "Accept",
  decline: "Decline",
  cancel: "Cancel",
  end: "End",
  loading: "Loading relationships…",
  error: "Something went wrong. Try again.",
  accepted: (name: string) => `You're now linked with ${name}.`,
  endDialog: {
    message: (name: string) =>
      `End your link with ${name}? It comes off both profiles straight away. They aren't told.`,
    confirm: "End link",
    keep: "Keep link",
  },
  ended: (name: string) => `Your link with ${name} has ended.`,
  /** The profile card. */
  card: {
    title: "Relationships",
    manage: "Manage",
    emptyOwn: "Link your D/s dynamics and relationships.",
    linkWith: (name: string) => `Link a relationship with ${name}`,
  },
} as const;
