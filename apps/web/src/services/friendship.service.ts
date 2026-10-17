import { friendshipRepository } from "@/repositories/friendship.repository";
import type { FriendshipAction } from "@/domain/friendship";
export const friendshipService = {
  change: (username: string, action: FriendshipAction) => friendshipRepository[action](username),
  requests: (direction: "incoming" | "outgoing", page: number) =>
    friendshipRepository.requests(direction, page),
};
