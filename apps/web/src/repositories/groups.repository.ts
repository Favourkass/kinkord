import type { GroupPM, GroupFeedPM, ShareFriendPM } from "@/domain/sharing";
interface GroupsTransport {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
}
const groupPath = (id: string) => `/groups/${encodeURIComponent(id)}`;
export const createGroupsRepository = (api: GroupsTransport) => ({
  list: () => api.get<GroupPM[]>("/groups"),
  friends: (q = "") => api.get<ShareFriendPM[]>(`/groups/friends?q=${encodeURIComponent(q)}`),
  create: (name: string, friends: string[]) => api.post<GroupPM>("/groups", { name, friends }),
  invite: (id: string, friends: string[]) => api.post(`${groupPath(id)}/invitations`, { friends }),
  removeMember: (id: string, userId: string) =>
    api.del(`${groupPath(id)}/members/${encodeURIComponent(userId)}`),
  accept: (id: string) => api.post(`${groupPath(id)}/accept`, {}),
  leave: (id: string) => api.del(`${groupPath(id)}/membership`),
  remove: (id: string) => api.del(groupPath(id)),
  feed: (id: string, page = 1) => api.get<GroupFeedPM>(`${groupPath(id)}/posts?page=${page}`),
  removePost: (id: string, postId: string) =>
    api.del(`${groupPath(id)}/posts/${encodeURIComponent(postId)}`),
});
