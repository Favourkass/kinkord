import { useEffect, useRef } from "react";
import type { MessageVM } from "@/domain/chat";
import ChatMessageBubble from "./ChatMessageBubble";

export interface ChatMessageTimelineProps {
  messages: MessageVM[];
  onReply?: (message: MessageVM) => void;
  dateLabel?: string;
}

export default function ChatMessageTimeline({
  messages,
  onReply,
  dateLabel = "Today",
}: ChatMessageTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on mount and when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {/* Date Pill */}
      <div className="flex justify-center my-3">
        <span className="rounded-full bg-[#1c1c20] px-3 py-1 text-[11px] font-medium text-[#8e8e93] border border-white/5">
          {dateLabel}
        </span>
      </div>

      {/* Messages */}
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} onReply={onReply} />
      ))}

      {/* Anchor for auto-scroll */}
      <div ref={bottomRef} />
    </div>
  );
}
