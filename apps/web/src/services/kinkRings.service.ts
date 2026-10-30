/** Kink Rings: the member's own, and giving one away. */
import type {
  RingRecipientDraft,
  RingGiftAssignment,
  GiveRingPM,
  KinkRingsPM,
  RingInventoryPM,
  RingPagePM,
  RingHistoryPM,
  RingInventoryItemPM,
  RingRecipientPM,
} from "@/domain/kinkRings";
import { ApiError, api } from "./apiClient";

export const kinkRingsApi = {
  inventory: () => api.get<RingInventoryPM>("/kink-rings/inventory"),
  history: (page: number) => api.get<RingPagePM<RingHistoryPM>>(`/kink-rings/history?page=${page}`),
  expired: (page: number) =>
    api.get<RingPagePM<RingInventoryItemPM> & { total: number }>(
      `/kink-rings/expired?page=${page}`,
    ),
  recipients: (tab: "friends" | "search", query: string, page: number) =>
    api.get<RingPagePM<RingRecipientPM>>(
      `/kink-rings/recipients?tab=${tab}&q=${encodeURIComponent(query)}&page=${page}`,
    ),
  giveSelected: (gifts: RingGiftAssignment[]) =>
    api.post<{ gifts: Array<{ ringId: string; to: { username: string; displayName: string } }> }>(
      "/kink-rings/give-selected",
      { gifts },
    ),
  mine: () => api.get<KinkRingsPM>("/kink-rings"),
  /** "@Ada" or "ada": the API reads usernames lowercase. */
  give: (username: string) =>
    api.post<GiveRingPM>("/kink-rings/give", { username: username.trim().replace(/^@/, "") }),
};

/**
 * Why a ring couldn't be given, in the API's own words when it said (no such
 * member, Silver for good already, none left); else the screen's fallback.
 */
export function giveRingError(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
    const message = (e.body as { message?: unknown } | null)?.message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

/** Assign distinct selected rings to the reviewed recipient quantities, retaining any unused rings. */
export function ringGiftAssignments(
  ringIds: string[],
  recipients: Array<{ username: string; quantity: number }>,
) {
  if (!recipients.length || new Set(ringIds).size !== ringIds.length || ringIds.length > 50)
    throw new Error("Choose rings and recipients first.");
  if (
    new Set(recipients.map((r) => r.username.toLowerCase())).size !== recipients.length ||
    recipients.some((r) => !r.username || !Number.isInteger(r.quantity) || r.quantity < 1)
  )
    throw new Error("Each recipient needs at least one ring.");
  const total = recipients.reduce((sum, r) => sum + r.quantity, 0);
  if (total > ringIds.length) throw new Error("You do not have enough selected rings.");
  let at = 0;
  return recipients.flatMap((r) =>
    Array.from({ length: r.quantity }, () => ({ ringId: ringIds[at++], username: r.username })),
  );
}

/** A recipient always receives at least one distinct ring from this selected inventory. */
export function resizeRingAllocation(
  draft: RingRecipientDraft[],
  userId: string,
  quantity: number,
  selected: string[],
): RingRecipientDraft[] {
  const recipient = draft.find((p) => p.member.userId === userId);
  if (!recipient || !Number.isInteger(quantity) || quantity < 1 || quantity > 50)
    throw new Error("Choose between 1 and 50 rings per recipient.");
  const used = new Set(draft.flatMap((p) => p.ringIds));
  const free = selected.filter((id) => !used.has(id));
  const extra = quantity - recipient.ringIds.length;
  if (extra > free.length) throw new Error("You do not have enough selected rings.");
  const ringIds =
    extra > 0
      ? [...recipient.ringIds, ...free.slice(0, extra)]
      : recipient.ringIds.slice(0, quantity);
  return draft.map((p) => (p.member.userId === userId ? { ...p, ringIds } : p));
}

/** Choosing a ring already assigned elsewhere swaps the two slots; no ring can be gifted twice. */
export function replaceRingAllocation(
  draft: RingRecipientDraft[],
  userId: string,
  slot: number,
  ringId: string,
  selected: string[],
): RingRecipientDraft[] {
  const recipient = draft.find((p) => p.member.userId === userId);
  const previous = recipient?.ringIds[slot];
  if (!previous || !selected.includes(ringId))
    throw new Error("Choose a ring from your selected inventory.");
  return draft.map((p) => ({
    ...p,
    ringIds: p.ringIds.map((id, i) =>
      p.member.userId === userId && i === slot ? ringId : id === ringId ? previous : id,
    ),
  }));
}

/** The final payload is made from the exact reviewed IDs and personal messages. */
export function ringAllocationGifts(
  selected: string[],
  draft: RingRecipientDraft[],
): RingGiftAssignment[] {
  if (!draft.length || selected.length > 50 || new Set(selected).size !== selected.length)
    throw new Error("Choose rings and recipients first.");
  if (new Set(draft.map((p) => p.member.username.toLowerCase())).size !== draft.length)
    throw new Error("Choose each recipient once.");
  const used = new Set<string>();
  return draft.flatMap((p) => {
    if (!p.member.username || !p.ringIds.length)
      throw new Error("Assign at least one ring to each recipient.");
    const message = p.message.trim();
    if (message.length > 500)
      throw new Error("Personal messages can contain up to 500 characters.");
    return p.ringIds.map((ringId) => {
      if (!selected.includes(ringId) || used.has(ringId))
        throw new Error("Each selected ring can be assigned only once.");
      used.add(ringId);
      return { ringId, username: p.member.username, ...(message ? { message } : {}) };
    });
  });
}
