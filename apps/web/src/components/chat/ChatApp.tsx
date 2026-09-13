"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../lib/api";
import { getSocket } from "../../../lib/socket";
import type { Conversation, Message, User } from "../../../lib/types";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";

export default function ChatApp() {
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<Record<string, Set<string>>>({});
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Load the current identity from the Better Auth session cookie.
  useEffect(() => {
    api
      .me()
      .then((user) =>
        setMe({
          id: user.id,
          username: user.username ?? user.email,
          displayName: user.name,
          avatarUrl: user.image,
        }),
      )
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  // Load initial data once signed in.
  useEffect(() => {
    if (!me) return;
    (async () => {
      const cs = await api.conversations();
      setConversations(cs);
    })().catch(console.error);
  }, [me]);

  // Socket lifecycle.
  useEffect(() => {
    if (!me) return;
    const s = getSocket();
    socketRef.current = s;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onPresenceSnapshot = ({ online }: { online: string[] }) => {
      setOnlineUsers(new Set(online));
    };
    const onPresenceUpdate = ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };
    const onUnreadSnapshot = (map: Record<string, number>) => {
      setConversations((prev) => prev.map((c) => ({ ...c, unreadCount: map[c.id] ?? 0 })));
    };
    const onUnreadBump = ({ conversationId, count }: { conversationId: string; count: number }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: count } : c)),
      );
    };
    const onUnreadCleared = ({ conversationId }: { conversationId: string }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      );
    };
    const onNewMessage = (m: Message) => {
      setMessagesByConv((prev) => {
        const list = prev[m.conversationId] ?? [];
        if (list.some((x) => x.id === m.id)) return prev;
        // Replace pending local copy if the clientId matches.
        const idx = m.clientId
          ? list.findIndex((x) => x.clientId === m.clientId && x.senderId === m.senderId)
          : -1;
        const next = idx >= 0 ? [...list.slice(0, idx), m, ...list.slice(idx + 1)] : [...list, m];
        return { ...prev, [m.conversationId]: next };
      });
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === m.conversationId);
        const patched = prev.map((c) =>
          c.id === m.conversationId ? { ...c, lastMessage: m, lastMessageAt: m.createdAt } : c,
        );
        if (!exists) {
          // New conversation appeared — refetch the list.
          api.conversations().then(setConversations).catch(console.error);
        }
        return patched;
      });
    };
    const onMessageRead = (_: { conversationId: string; userId: string; messageId: string }) => {};
    const onTyping = ({ conversationId, userId, typing: t }: any) => {
      setTyping((prev) => {
        const next = { ...prev };
        const set = new Set(next[conversationId] ?? []);
        if (t) set.add(userId);
        else set.delete(userId);
        next[conversationId] = set;
        return next;
      });
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("presence:snapshot", onPresenceSnapshot);
    s.on("presence:update", onPresenceUpdate);
    s.on("unread:snapshot", onUnreadSnapshot);
    s.on("unread:bump", onUnreadBump);
    s.on("unread:cleared", onUnreadCleared);
    s.on("message:new", onNewMessage);
    s.on("message:read", onMessageRead);
    s.on("typing", onTyping);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("presence:snapshot", onPresenceSnapshot);
      s.off("presence:update", onPresenceUpdate);
      s.off("unread:snapshot", onUnreadSnapshot);
      s.off("unread:bump", onUnreadBump);
      s.off("unread:cleared", onUnreadCleared);
      s.off("message:new", onNewMessage);
      s.off("message:read", onMessageRead);
      s.off("typing", onTyping);
    };
  }, [me]);

  // Load messages when a conversation is selected.
  useEffect(() => {
    if (!me || !activeId) return;
    if (messagesByConv[activeId]) return;
    api
      .messages(activeId)
      .then((msgs) => {
        setMessagesByConv((prev) => ({ ...prev, [activeId]: msgs }));
        const last = msgs[msgs.length - 1];
        if (last) api.markRead(activeId, last.id).catch(() => {});
      })
      .catch(console.error);
  }, [me, activeId, messagesByConv]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }, []);

  const handleSend = useCallback(
    (body: string, attachmentIds: string[]) => {
      if (!me || !activeId || !socketRef.current) return;
      const clientId = crypto.randomUUID();
      const optimistic: Message = {
        id: `local:${clientId}`,
        conversationId: activeId,
        senderId: me.id,
        body: body || null,
        clientId,
        createdAt: new Date().toISOString(),
        attachments: [],
        pending: true,
      };
      setMessagesByConv((prev) => ({
        ...prev,
        [activeId]: [...(prev[activeId] ?? []), optimistic],
      }));
      socketRef.current.emit(
        "message:send",
        { conversationId: activeId, body, clientId, attachmentIds },
        (res: any) => {
          if (!res?.ok) {
            setMessagesByConv((prev) => ({
              ...prev,
              [activeId]: (prev[activeId] ?? []).map((m) =>
                m.clientId === clientId ? { ...m, pending: false, failed: true } : m,
              ),
            }));
          }
        },
      );
    },
    [me, activeId],
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (!activeId || !socketRef.current) return;
      socketRef.current.emit("typing", { conversationId: activeId, typing: isTyping });
    },
    [activeId],
  );

  const handleAttach = useCallback(
    async (files: FileList) => {
      if (!me) return [];
      const ids: string[] = [];
      for (const file of Array.from(files)) {
        const { attachmentId, uploadUrl } = await api.presign(
          file.name,
          file.type || "application/octet-stream",
          file.size,
        );
        const put = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "content-type": file.type || "application/octet-stream" },
        });
        if (!put.ok) throw new Error(`upload failed: ${put.status}`);
        ids.push(attachmentId);
      }
      return ids;
    },
    [me],
  );

  const signOut = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setMe(null);
    setConversations([]);
    setMessagesByConv({});
    setActiveId(null);
  };

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading chat…</div>;
  if (!me) return <div className="p-6 text-sm text-slate-500">Sign in to use chat.</div>;

  return (
    <div className="h-screen flex">
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onlineUsers={onlineUsers}
        me={me}
        onSelect={handleSelect}
      />
      <div className="flex-1 flex flex-col">
        <div
          className={`text-xs px-4 py-1 ${connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
        >
          {connected ? "Connected" : "Reconnecting…"}
          <button onClick={signOut} className="float-right underline">
            sign out
          </button>
        </div>
        <ChatWindow
          me={me}
          conversation={activeConversation}
          messages={activeId ? (messagesByConv[activeId] ?? []) : []}
          onlineUsers={onlineUsers}
          typingUserIds={typing[activeId ?? ""] ?? new Set()}
          onSend={handleSend}
          onTyping={handleTyping}
          onAttach={handleAttach}
        />
      </div>
    </div>
  );
}
