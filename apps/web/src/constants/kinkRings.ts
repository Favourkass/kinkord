/** Copy for Kink Rings: a month of Silver to give away. */
import type { KinkRingsLabels } from "@/domain/kinkRings";

export const KINK_RINGS_COPY = {
  title: "Kink Rings",
  intro:
    "Each Kink Ring gives someone a month of Silver. Silver for a month brings one ring; Silver for a year brings twelve, one expiring each month. Give them before they expire.",
  labels: {
    count: (n: number) =>
      n === 0
        ? "You have no Kink Rings to give"
        : `You have ${n} Kink Ring${n === 1 ? "" : "s"} to give`,
    expires: (date: string) => `Expires ${date}`,
    givenTo: (name: string, date: string) => `${name}, ${date}`,
    someoneGone: "A member who has left",
  } satisfies KinkRingsLabels,
  give: "Give a ring",
  searchLabel: "Find a member",
  searchPlaceholder: "Name or @username",
  searching: "Searching…",
  noMatches: "No members match that.",
  confirm: (name: string) => `Give ${name} a Kink Ring? They get a month of Silver.`,
  confirmButton: "Give ring",
  giving: "Giving…",
  cancel: "Cancel",
  given: (name: string) => `Ring given. ${name} has a month of Silver.`,
  giveFailed: "Couldn't give that ring. Try again.",
  none: "Get Silver to get Kink Rings to give.",
  getSilver: "Get Silver",
  givenHeading: "Rings you gave",
  loading: "Loading…",
  loadFailed: "Couldn't load your Kink Rings. Refresh to try again.",
  dismiss: "Dismiss",
} as const;
