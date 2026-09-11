import { CheckCheck, CornerUpLeft } from "lucide-react";
import type { MessageVM } from "@/domain/chat";

export interface ChatMessageBubbleProps {
  message: MessageVM;
  onReply?: (message: MessageVM) => void;
}

export default function ChatMessageBubble({ message, onReply }: ChatMessageBubbleProps) {
  const { isOutgoing, text, timeLabel, readStatus, replyTo } = message;

  return (
    <div
      className={`group relative flex w-full my-1 ${isOutgoing ? "justify-end" : "justify-start"}`}
    >
      {/* Quick reply button on hover */}
      {onReply && (
        <button
          type="button"
          onClick={() => onReply(message)}
          aria-label="Reply to message"
          className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#8e8e93] hover:text-kink-gold-bright ${
            isOutgoing ? "-left-8" : "-right-8"
          }`}
        >
          <CornerUpLeft className="size-4" />
        </button>
      )}

      {/* Bubble Container */}
      <div
        className={`relative flex flex-col max-w-[82%] px-3.5 pt-2 pb-1.5 shadow-sm ${
          isOutgoing
            ? "rounded-2xl rounded-tr-xs bg-kink-gold-bright text-black"
            : "rounded-2xl rounded-tl-xs bg-[#202024] text-white border border-white/5"
        }`}
      >
        {/* Quoted Message (Reply Preview) */}
        {replyTo && (
          <div
            className={`mb-1.5 flex flex-col rounded-md px-2.5 py-1 text-[12px] border-l-2 ${
              isOutgoing
                ? "bg-black/10 border-black/80 text-black"
                : "bg-black/30 border-kink-gold-bright text-white"
            }`}
          >
            <span
              className={`font-semibold text-[11px] ${
                isOutgoing ? "text-black" : "text-kink-gold-bright"
              }`}
            >
              {replyTo.senderName}
            </span>
            <span className="truncate opacity-85">{replyTo.text}</span>
          </div>
        )}

        {/* Message Text */}
        <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed font-normal">
          {text}
        </p>

        {/* Timestamp and Read Status */}
        <div
          className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] self-end ${
            isOutgoing ? "text-black/75 font-medium" : "text-[#8e8e93]"
          }`}
        >
          <span>{timeLabel}</span>
          {isOutgoing && (
            <CheckCheck
              className={`size-3.5 ${readStatus === "read" ? "text-black" : "text-black/60"}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
