"use client";
import { useEffect, useMemo, useRef } from "react";
import type { Conversation, Message, User } from "../../../lib/types";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";

export default function ChatWindow({
  me,
  conversation,
  messages,
  onlineUsers,
  typingUserIds,
  onSend,
  onTyping,
  onAttach,
}: {
  me: User;
  conversation: Conversation | null;
  messages: Message[];
  onlineUsers: Set<string>;
  typingUserIds: Set<string>;
  onSend: (body: string, attachmentIds: string[]) => void;
  onTyping: (typing: boolean) => void;
  onAttach: (files: FileList) => Promise<string[]>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const peer = conversation?.participants.find((p) => p.id !== me.id) ?? null;
  const online = peer ? onlineUsers.has(peer.id) : false;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, conversation?.id]);

  const typingLabel = useMemo(() => {
    if (!typingUserIds.size) return null;
    return "typing…";
  }, [typingUserIds]);

  if (!conversation) {
    return (
      <main className="flex-1 flex items-center justify-center text-slate-500">
        Select a conversation to start chatting.
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      <header className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
            {peer?.displayName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="font-semibold">
              {peer?.displayName ?? conversation.title ?? "Conversation"}
            </div>
            <div className="text-xs">
              {online ? (
                <span className="text-emerald-600">● Online</span>
              ) : (
                <span className="text-slate-400">○ Offline</span>
              )}
            </div>
          </div>
        </div>
        {typingLabel && <div className="text-xs text-slate-500">{typingLabel}</div>}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50">
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} mine={m.senderId === me.id} />
        ))}
      </div>

      <MessageComposer disabled={false} onSend={onSend} onTyping={onTyping} onAttach={onAttach} />
    </main>
  );
}
