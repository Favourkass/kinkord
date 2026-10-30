/** Kink Rings: the member's own, and giving one away. */
import type {
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
  giveSelected: (gifts: Array<{ ringId: string; username: string }>) =>
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
