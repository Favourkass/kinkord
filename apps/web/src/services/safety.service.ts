/** Blocking another member, and reporting them to the moderators. */
import type { ReportInputPM } from "@/domain/safety";
import { api } from "./apiClient";

export const safetyService = {
  block: (userId: string) => api.post<{ blocked: string }>("/blocks", { userId }),

  unblock: (userId: string) =>
    api.del<{ unblocked: string }>(`/blocks/${encodeURIComponent(userId)}`),

  report: (input: ReportInputPM) => api.post<{ id: string }>("/reports", input),
};
