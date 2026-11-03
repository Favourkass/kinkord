import type { TeamMemberPM, TeamPageAdminMemberPM, TeamPageAdminPM } from "@/domain/team";
import { api } from "./apiClient";

/** Meet the Team: anyone may read it. */
export const teamApi = {
  list: () => api.get<{ members: TeamMemberPM[] }>("/team").then((r) => r.members),
};

/** Who is on Meet the Team and what they do. Every admin reads; the founders change it. */
export const teamPageAdminApi = {
  list: () => api.get<TeamPageAdminPM>("/admin/team-page"),
  /** Adds them with this role, or changes the role they have. */
  setTitle: (username: string, title: string) =>
    api.post<TeamPageAdminMemberPM>("/admin/team-page", { username, title }),
  remove: (id: string) =>
    api.del<{ removed: string }>(`/admin/team-page/${encodeURIComponent(id)}`),
};
