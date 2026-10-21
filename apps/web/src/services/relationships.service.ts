import type { RelationshipOptionsPM, RelationshipsPM } from "@/domain/relationship";
import { api } from "./apiClient";

/** A username as typed (" @Tolu ") the way the API reads it: "tolu". */
export function relationshipHandle(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

/** Usernames are 3 to 30 letters, digits and underscores. */
export function canRequestRelationship(username: string, type: string): boolean {
  return /^[a-z0-9_]{3,30}$/.test(relationshipHandle(username)) && type.trim().length > 0;
}

/** Every change answers with the whole list again, so the screen never drifts. */
export const relationshipsApi = {
  options: () => api.get<RelationshipOptionsPM>("/relationships/options"),
  list: () => api.get<RelationshipsPM>("/relationships"),
  request: (username: string, type: string) =>
    api.post<RelationshipsPM>("/relationships", { username: relationshipHandle(username), type }),
  accept: (id: string) =>
    api.post<RelationshipsPM>(`/relationships/${encodeURIComponent(id)}/accept`, {}),
  /** Declines or cancels a request, or ends a link. */
  remove: (id: string) => api.del<RelationshipsPM>(`/relationships/${encodeURIComponent(id)}`),
};
