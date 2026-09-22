import { chatRepository } from "@/repositories/chat.repository";

/**
 * Anything the chat screens need that isn't a live socket event. Today this is
 * a pass-through; the seam is here because it is where per-conversation policy
 * (mute, block, "do not disturb" hours) will live when those ship.
 */
export const chatService = {
  listConversations: () => chatRepository.listConversations(),
  startDm: (userId: string) => chatRepository.startDm(userId),
  history: (id: string, before?: string) => chatRepository.history(id, before),
  markRead: (id: string, messageId: string) => chatRepository.markRead(id, messageId),
  presence: (userIds: string[]) => chatRepository.presence(userIds),
  me: () => chatRepository.me(),
};
