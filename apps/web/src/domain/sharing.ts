import type { PostPM } from "./post";
export interface ShareFriendPM {
  userId: string;
  username: string | null;
  displayName: string | null;
}
export interface GroupPM {
  id: string;
  name: string;
  ownerId: string;
  status: "invited" | "joined";
}
export interface GroupFeedPM {
  members: Array<{
    id: string;
    name: string | null;
    status: "joined" | "invited";
    canRemove: boolean;
  }>;
  group: Omit<GroupPM, "status"> & { isOwner: boolean };
  items: Array<{
    id: string;
    caption: string;
    sharedBy: string;
    createdAt: string;
    canRemove: boolean;
    post: PostPM;
  }>;
  nextPage: number | null;
}
export type ShareMode = "choices" | "caption" | "friends" | "groups";
export type ExternalShare = "whatsapp" | "twitter" | "native" | "copy";
