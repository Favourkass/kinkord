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

export const RING_FLOW_COPY = {
  title: "Kink Rings",
  subtitle: "Give Silver Premium to someone special",
  gift: "Gift Kink Ring",
  buy: "Buy Kink Ring",
  history: "Gifting History",
  viewAll: "View all",
  available: "Kink Rings Available",
  singleAvailable: "Kink Ring Available",
  multiple: "Select Multiple",
  giftRing: "Gift Ring",
  expired: "Expired Rings",
  expirySoon: "Expiring Soon",
  copy: "Copy full ring ID",
  copied: "Ring ID copied.",
  copyFailed: "Could not copy. Open the ring details to select the ID.",
  friends: "Friends",
  search: "Search",
  find: "Find a recipient",
  searchPlaceholder: "Name or @username",
  recipients: "Choose Recipient",
  selected: "Selected Recipients",
  allocation: "Ring Allocation",
  messages: "Personal Messages",
  review: "Review & Confirm",
  gifting: "Gifting",
  selectedIntro: "Review who will receive your Kink Rings.",
  allocationIntro: "Assign your selected Kink Rings to each recipient.",
  messageIntro: "Add an optional personal message for each recipient.",
  reviewIntro: "Please review your gift details before sending.",
  allocationNote:
    "Assign at least one ring to each recipient. Choosing a ring already assigned to someone else swaps the two rings.",
  finalNote:
    "Each recipient will receive their personal message with the gift notification. You can go back to edit before confirming. Sent rings cannot be taken back.",
  messageLabel: "Message",
  messagePlaceholder: "Enjoy your Kink Ring! 💛",
  noteNotAllowed: (name: string) =>
    `${name} doesn't take messages from you, so their ring goes without a note.`,
  editRecipients: "Edit Recipients",
  reviewButton: "Review Gifts",
  toMessage: "Continue to Message",
  noMessage: "No personal message",
  continue: "Continue",
  addMore: "Add More Recipients",
  reviewNote:
    "Each ring gives one month of Silver. Review the number of rings for each recipient before sending.",
  confirm: "Confirm & Gift",
  cancel: "Back",
  remove: "Remove recipient",
  quantity: "Rings",
  loading: "Loading…",
  emptyFriends: "No friends to show. Use Search to find a member.",
  emptySearch: "No matching members.",
  searchHint: "Enter at least two characters to search.",
  searchError: "Could not load recipients. Try again.",
  noHistory: "Your gifts will appear here after you send a Kink Ring.",
  noRings: "You have no rings available. Buy rings or get them with Silver Premium.",
  noExpired: "No expired rings.",
  more: "Load more",
  retry: "Try again",
  sending: "Gifting…",
  dismiss: "Dismiss",
  info: "About Kink Rings",
  close: "Close",
  details: "Ring details",
  /** `perPlan`: how many rings each plan brings now, from the API; null while it loads. */
  infoText: (perPlan: { monthly: number; yearly: number } | null) => {
    const count = (n: number) => (n === 0 ? "no rings" : n === 1 ? "one ring" : `${n} rings`);
    const plans = perPlan
      ? ` Monthly Silver includes ${count(perPlan.monthly)}; yearly Silver includes ${count(perPlan.yearly)}, expiring one month apart.`
      : "";
    return `Every ring gives someone one month of Silver.${plans} Separately purchased rings expire 90 days after payment confirmation. Unused rings expire on their listed dates. Gifting history shows each recipient’s current Silver status.`;
  },
  max: "You can select up to 50 rings per gift.",
  maxRecipients: "Select more rings to add another recipient.",
  error: "Could not send the rings. Your selection is saved; retry to check the same gift safely.",
  loadError: "Could not load your Kink Rings. Please try again.",
  success: "Your Kink Rings have been gifted.",
  successTitle: "Kink Rings Gifted!",
  successIntro: "Your Kink Rings have been sent to your selected recipients.",
  giftSummary: "Gift Summary",
  totalSent: "Total Kink Rings Sent",
  dateTime: "Date & Time (Lagos)",
  successNote:
    "Silver time has been added to each recipient's account. Their gift notification includes your personal message, if provided.",
  done: "Done",
  back: "Back",
  purchaseNote: "Buy extra rings, or get rings with Silver Premium.",
  received: "Received",
  expiry: "Expiry",
} as const;
