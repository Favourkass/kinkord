import type {
  GroupCategory,
  GroupInputPM,
  GroupMemberStatus,
  GroupMembersPagePM,
  GroupOptionsPM,
  GroupPM,
  GroupsPagePM,
  GroupsView,
  GroupThreadPM,
} from "@/domain/group";
import type { FeedPM, PostPM } from "@/domain/post";
import { api } from "./apiClient";
import { uploadPostPhoto } from "./posts.service";

const g = (slug: string) => `/groups/${encodeURIComponent(slug)}`;

export interface AdminGroupPM {
  id: string;
  slug: string;
  name: string;
  category: GroupCategory;
  privacy: "open" | "closed";
  createdAt: string;
  archivedAt: string | null;
  members: number;
  ownerId: string | null;
  ownerUsername: string | null;
}

export interface NewThreadInput {
  title: string;
  body: string;
  /** Photos to upload first, in the order they should appear. */
  photos: File[];
}

/** Groups: the directory, a group, its members and its discussions. */
export const groupsService = {
  options: () => api.get<GroupOptionsPM>("/groups/options"),
  list: (params: {
    view: GroupsView;
    q?: string;
    category?: GroupCategory | null;
    page?: number;
  }) => {
    const qs = new URLSearchParams({ view: params.view });
    if (params.q?.trim()) qs.set("q", params.q.trim());
    if (params.category) qs.set("category", params.category);
    if (params.page && params.page > 1) qs.set("page", String(params.page));
    return api.get<GroupsPagePM>(`/groups?${qs.toString()}`);
  },
  create: (input: GroupInputPM) => api.post<GroupPM>("/groups", input),
  detail: (slug: string) => api.get<GroupPM>(g(slug)),
  /** Everything but who can join, which is chosen once. */
  update: (slug: string, input: Partial<Omit<GroupInputPM, "privacy">>) =>
    api.patch<GroupPM>(g(slug), input),
  closeDown: (slug: string) => api.del<{ archived: string }>(g(slug)),
  join: (slug: string) => api.post<{ status: GroupMemberStatus }>(`${g(slug)}/join`, {}),
  leave: (slug: string) => api.del<{ status: null }>(`${g(slug)}/membership`),
  members: (slug: string, status: GroupMemberStatus, page = 1) =>
    api.get<GroupMembersPagePM>(`${g(slug)}/members?status=${status}&page=${page}`),
  approve: (slug: string, userId: string) =>
    api.post<{ status: "active" }>(`${g(slug)}/members/${encodeURIComponent(userId)}/approve`, {}),
  /** Decline a request, or remove a member. */
  removeMember: (slug: string, userId: string) =>
    api.del<{ removed: string }>(`${g(slug)}/members/${encodeURIComponent(userId)}`),
  setRole: (slug: string, userId: string, role: "moderator" | "member") =>
    api.put<{ role: string }>(`${g(slug)}/members/${encodeURIComponent(userId)}/role`, { role }),
  threads: (slug: string, cursor?: string | null) =>
    api.get<FeedPM>(`${g(slug)}/threads${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  /** Uploads the photos, then posts the discussion naming them. */
  createThread: async (slug: string, input: NewThreadInput) => {
    const keys = [];
    for (const photo of input.photos) keys.push(await uploadPostPhoto(photo));
    return api.post<PostPM>(`${g(slug)}/threads`, {
      title: input.title.trim(),
      body: input.body.trim(),
      media: keys.map((key) => ({ key, kind: "image" as const })),
    });
  },
  thread: (slug: string, postId: string) =>
    api.get<GroupThreadPM>(`${g(slug)}/threads/${encodeURIComponent(postId)}`),
  pin: (slug: string, postId: string, pinned: boolean) =>
    api.post<{ pinned: boolean }>(`${g(slug)}/threads/${encodeURIComponent(postId)}/pin`, {
      pinned,
    }),
  close: (slug: string, postId: string, closed: boolean) =>
    api.post<{ closed: boolean }>(`${g(slug)}/threads/${encodeURIComponent(postId)}/close`, {
      closed,
    }),
  removeThread: (slug: string, postId: string) =>
    api.del<{ deleted: string }>(`${g(slug)}/threads/${encodeURIComponent(postId)}`),
  adminList: (status: "all" | "live" | "archived", page = 1) =>
    api.get<{ items: AdminGroupPM[]; hasMore: boolean }>(
      `/admin/groups?status=${status}&page=${page}`,
    ),
  adminArchive: (id: string, archived: boolean) =>
    api.post<{ id: string; archived: boolean }>(`/admin/groups/${encodeURIComponent(id)}/archive`, {
      archived,
    }),
};
