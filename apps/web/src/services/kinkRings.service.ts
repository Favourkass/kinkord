/** Kink Rings: the member's own, and giving one away. */
import type { GiveRingPM, KinkRingsPM } from "@/domain/kinkRings";
import { ApiError, api } from "./apiClient";

export const kinkRingsApi = {
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
