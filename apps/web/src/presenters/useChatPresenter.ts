"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import {
  toConversationVM,
  toMessageVM,
  type ChatFilter,
  type ConversationPM,
  type ConversationVM,
  type MessagePM,
  type MessageVM,
} from "@/domain/chat";
import { api, ApiError } from "@/services/apiClient";
import * as chatService from "@/services/chat.service";
import type { MeVM, ProfileVM } from "./useProfilePresenter";

export interface ChatPresenterOptions {
  initialConversationId?: string | null;
  initialUsername?: string | null;
}

export function useChatPresenter(options: ChatPresenterOptions = {}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string>("current-user");
  const [authUserName, setAuthUserName] = useState<string>("You");
  const [authUserAvatar, setAuthUserAvatar] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConversationPM[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    options.initialConversationId ?? null,
  );
  const [messages, setMessages] = useState<MessagePM[]>([]);
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<MessageVM | null>(null);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [encryptionNoticeVisible, setEncryptionNoticeVisible] = useState(true);
  const [disappearingNoticeVisible, setDisappearingNoticeVisible] = useState(true);

  // 1. Authenticate user & load profile
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [me, profile] = await Promise.all([
          api.get<MeVM & { name?: string | null }>("/me"),
          api.get<ProfileVM>("/profile"),
        ]);
        if (cancelled) return;
        setAuthUserId(me.id);
        setAuthUserName(profile.displayName || me.username || "You");
        setAuthUserAvatar(profile.avatarUrl);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(Routes.login);
          return;
        }
        // If local mock environment without backend, retain fallback identity
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // 2. Load conversations
  // 2. Load conversations
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await chatService.fetchConversations();
      if (cancelled) return;
      setConversations(list);

      if (options.initialUsername) {
        const target = list.find(
          (c) => c.username?.toLowerCase() === options.initialUsername?.toLowerCase(),
        );
        if (target) {
          setActiveConversationId(target.id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [options.initialUsername]);

  // 3. Load messages when active conversation changes
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!activeConversationId) {
        if (!cancelled) setMessages([]);
        return;
      }
      const msgs = await chatService.fetchMessages(activeConversationId);
      if (cancelled) return;
      setMessages(msgs);
      await chatService.markConversationAsRead(activeConversationId);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  // Active conversation PM
  const activeConversationPM = useMemo(() => {
    if (!activeConversationId) return null;
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  }, [activeConversationId, conversations]);

  // View Models
  const activeConversationVM = useMemo<ConversationVM | null>(() => {
    if (!activeConversationPM) return null;
    return toConversationVM(activeConversationPM, authUserId);
  }, [activeConversationPM, authUserId]);

  const messagesVM = useMemo<MessageVM[]>(() => {
    return messages.map((m) => toMessageVM(m, authUserId));
  }, [messages, authUserId]);

  const displayedConversationsVM = useMemo<ConversationVM[]>(() => {
    const filtered = chatService.filterConversations(conversations, filter);
    const searched = chatService.searchConversations(filtered, searchQuery);
    const sorted = chatService.sortConversations(searched);
    return sorted.map((c) => toConversationVM(c, authUserId));
  }, [conversations, filter, searchQuery, authUserId]);

  // Handlers
  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setReplyingTo(null);
  }, []);

  const clearActiveConversation = useCallback(() => {
    setActiveConversationId(null);
    setReplyingTo(null);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const openNewChat = useCallback(() => setNewChatModalOpen(true), []);
  const closeNewChat = useCallback(() => setNewChatModalOpen(false), []);

  const sendMessage = useCallback(async () => {
    if (!activeConversationId || !messageDraft.trim()) return;

    const draft = messageDraft.trim();
    const reply = replyingTo
      ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text }
      : null;

    setMessageDraft("");
    setReplyingTo(null);

    const saved = await chatService.sendChatMessage({
      conversationId: activeConversationId,
      senderId: authUserId,
      senderName: authUserName,
      text: draft,
      replyTo: reply,
    });

    setMessages((prev) => [...prev, saved]);
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === activeConversationId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        lastMessage: saved,
        updatedAt: saved.createdAt,
      };
      return updated;
    });

    // Realistic responsive auto-reply for simulated interactions (e.g. Rosabel)
    const convName = activeConversationPM?.name ?? "";
    if (convName.toLowerCase().includes("rosabel")) {
      setTimeout(async () => {
        const replyText = chatService.getSimulatedResponse(convName);
        const incoming = await chatService.sendChatMessage({
          conversationId: activeConversationId,
          senderId: "user-rosabel",
          senderName: "Rosabel",
          text: replyText,
        });
        setMessages((prev) => [...prev, incoming]);
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === activeConversationId);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            lastMessage: incoming,
            updatedAt: incoming.createdAt,
          };
          return updated;
        });
      }, 1500);
    }
  }, [activeConversationId, messageDraft, replyingTo, authUserId, authUserName, activeConversationPM]);

  const startChatWith = useCallback(
    async (member: { name: string; username?: string; avatarUrl?: string | null }) => {
      const existing = conversations.find(
        (c) =>
          (member.username && c.username?.toLowerCase() === member.username.toLowerCase()) ||
          c.name.toLowerCase() === member.name.toLowerCase(),
      );

      if (existing) {
        setActiveConversationId(existing.id);
        setNewChatModalOpen(false);
        return;
      }

      const created = await chatService.startNewConversation({
        name: member.name,
        username: member.username,
        avatarUrl: member.avatarUrl,
        type: "direct",
      });

      setConversations((prev) => [created, ...prev]);
      setActiveConversationId(created.id);
      setNewChatModalOpen(false);
    },
    [conversations],
  );

  return {
    loading,
    authUserId,
    authUserName,
    authUserAvatar,
    conversations: displayedConversationsVM,
    activeConversation: activeConversationVM,
    activeConversationId,
    messages: messagesVM,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    messageDraft,
    setMessageDraft,
    replyingTo,
    setReplyingTo,
    cancelReply,
    sendMessage,
    selectConversation,
    clearActiveConversation,
    encryptionNoticeVisible,
    dismissEncryptionNotice: () => setEncryptionNoticeVisible(false),
    disappearingNoticeVisible,
    dismissDisappearingNotice: () => setDisappearingNoticeVisible(false),
    newChatModalOpen,
    openNewChat,
    closeNewChat,
    startChatWith,
  };
}
