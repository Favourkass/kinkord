import type { FormEvent, KeyboardEvent } from "react";
import { Camera, Paperclip, Send, Smile, X } from "lucide-react";
import type { MessageVM } from "@/domain/chat";

export interface ChatInputBarProps {
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  replyingTo?: MessageVM | null;
  onCancelReply?: () => void;
  onEmojiClick?: () => void;
  onAttachmentClick?: () => void;
  onCameraClick?: () => void;
  placeholder?: string;
}

export default function ChatInputBar({
  draft,
  onDraftChange,
  onSend,
  replyingTo,
  onCancelReply,
  onEmojiClick,
  onAttachmentClick,
  onCameraClick,
  placeholder = "Message Kinkster...",
}: ChatInputBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) {
      onSend();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (draft.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="sticky bottom-0 z-20 border-t border-white/5 bg-[#0d0d0e]/95 px-3 py-2.5 backdrop-blur-md">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-[#1c1c20] px-3 py-1.5 border-l-2 border-kink-gold-bright text-[12px]">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="font-semibold text-kink-gold-bright">
              Replying to {replyingTo.senderName}
            </span>
            <span className="truncate text-[#8e8e93]">{replyingTo.text}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="grid size-6 place-items-center text-[#8e8e93] hover:text-white transition"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Main Input Pill */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex flex-1 items-center rounded-2xl bg-[#18181c] px-3.5 py-1.5 border border-white/5 focus-within:border-kink-gold-bright/40 transition-colors">
          {/* Emoji / Sticker Button */}
          <button
            type="button"
            onClick={onEmojiClick}
            aria-label="Insert emoji"
            className="grid size-8 place-items-center text-[#8e8e93] hover:text-kink-gold-bright transition shrink-0 mr-1"
          >
            <Smile className="size-5" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent text-[14.5px] text-white placeholder-[#8e8e93] outline-none"
          />

          {/* Right Action Icons: Paperclip & Camera */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button
              type="button"
              onClick={onAttachmentClick}
              aria-label="Add attachment"
              className="grid size-8 place-items-center text-[#8e8e93] hover:text-white transition"
            >
              <Paperclip className="size-4.5" />
            </button>
            <button
              type="button"
              onClick={onCameraClick}
              aria-label="Take picture"
              className="grid size-8 place-items-center text-[#8e8e93] hover:text-white transition"
            >
              <Camera className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Send Button */}
        {draft.trim().length > 0 && (
          <button
            type="submit"
            aria-label="Send message"
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-kink-gold-bright text-black hover:brightness-110 active:scale-95 transition shadow-sm"
          >
            <Send className="size-4.5" />
          </button>
        )}
      </form>
    </div>
  );
}
