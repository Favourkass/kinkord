import type { AdminPostStatus, AdminPostsPM } from "@/domain/adminPosts";
import { api } from "./apiClient";
export const adminPostsService = {
  list: (page: number, status: AdminPostStatus) =>
    api.get<AdminPostsPM>(`/admin/posts?page=${page}&status=${status}`),
  archive: (id: string, archived: boolean) =>
    api.post(`/admin/posts/${encodeURIComponent(id)}/archive`, { archived }),
  remove: (id: string) => api.del(`/admin/posts/${encodeURIComponent(id)}`),
};
