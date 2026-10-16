export type FriendshipState = "none" | "outgoing" | "incoming" | "friends";
export type FriendshipAction = "request" | "accept" | "dismiss" | "remove";

export interface FriendRequestPM {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}
export interface FriendRequestsPagePM {
  items: FriendRequestPM[];
  hasMore: boolean;
}
export interface FriendshipCopy {
  add: string;
  requested: string;
  accept: string;
  decline: string;
  remove: string;
  cancel: string;
}

export function friendshipActions(state: FriendshipState, copy: FriendshipCopy) {
  switch (state) {
    case "incoming":
      return {
        label: copy.accept,
        action: "accept" as const,
        secondaryLabel: copy.decline,
        secondaryAction: "dismiss" as const,
      };
    case "outgoing":
      return {
        label: copy.cancel,
        action: "dismiss" as const,
        secondaryLabel: null,
        secondaryAction: null,
      };
    case "friends":
      return {
        label: copy.remove,
        action: "remove" as const,
        secondaryLabel: null,
        secondaryAction: null,
      };
    default:
      return {
        label: copy.add,
        action: "request" as const,
        secondaryLabel: null,
        secondaryAction: null,
      };
  }
}
