/** Everyone on Silver now, for admins. */
import type { SilverFilter, SilverMembersPM } from "@/domain/silverMembers";
import { api } from "./apiClient";

export const silverMembersAdminApi = {
  list: (source: SilverFilter, q: string, page: number) =>
    api.get<SilverMembersPM>(
      `/admin/silver-members?source=${source}&q=${encodeURIComponent(q)}&page=${page}`,
    ),
};
