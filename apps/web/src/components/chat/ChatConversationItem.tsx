import Image from "next/image";
import { CheckCheck, ImageIcon, Pin, Users, VolumeX } from "lucide-react";
import type { ConversationVM } from "@/domain/chat";

export interface ChatConversationItemProps {
  conversation: ConversationVM;
  isSelected?: boolean;
  onClick: () => void;
}

export default function ChatConversationItem({
  conversation,
  isSelected,
  onClick,
}: ChatConversationItemProps) {
  const {
    name,
    avatarUrl,
    isOnline,
    isPinned,
    isMuted,
    unreadBadge,
    timeLabel,
    previewText,
    previewSenderPrefix,
    readStatus,
    hasPhoto,
    type,
  } = conversation;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors ${
        isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.04] active:bg-white/[0.06]"
      }`}
    >
      {/* Avatar with live status dot */}
      <div className="relative shrink-0">
        {type === "group" ? (
          <div className="grid size-13 place-items-center rounded-full bg-[#6834d4] text-white">
            <Users className="size-6" />
          </div>
        ) : avatarUrl ? (
          <div className="relative size-13 overflow-hidden rounded-full ring-1 ring-white/10">
            <Image src={avatarUrl} alt={name} fill sizes="52px" className="object-cover" />
          </div>
        ) : (
          <div className="grid size-13 place-items-center rounded-full bg-zinc-800 text-zinc-300 font-semibold text-lg">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Status dot (only for direct conversations) */}
        {type !== "group" && (
          <span
            className={`absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-black ${
              isOnline ? "bg-[#34c759]" : "bg-[#636366]"
            }`}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate text-[16px] font-semibold text-white group-hover:text-kink-gold-bright transition-colors">
            {name}
          </h2>
          <span className="shrink-0 text-[12px] text-[#8e8e93] font-medium">{timeLabel}</span>
        </div>

        {/* Subtitle / Last Message */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-[#8e8e93]">
            {isOnline && isPinned && (
              <span className="shrink-0 text-[12px] font-medium text-[#34c759]">Online</span>
            )}
            {hasPhoto && <ImageIcon className="size-3.5 text-kink-gold-bright shrink-0" />}
            <p className="truncate">
              {previewSenderPrefix && (
                <span className="text-[#a78bfa] font-medium">{previewSenderPrefix}</span>
              )}
              {previewText}
            </p>
          </div>

          {/* Indicators column: Pin, Mute, Read receipts, Unread count */}
          <div className="flex shrink-0 items-center gap-1.5">
            {isPinned && <Pin className="size-3.5 text-[#8e8e93] fill-current" />}
            {isMuted && <VolumeX className="size-3.5 text-[#8e8e93]" />}
            {readStatus && (
              <CheckCheck
                className={`size-4 ${
                  readStatus === "read" ? "text-kink-gold-bright" : "text-[#8e8e93]"
                }`}
              />
            )}
            {unreadBadge && (
              <span className="grid size-5 place-items-center rounded-full bg-kink-gold-bright text-[11px] font-bold text-black">
                {unreadBadge}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
