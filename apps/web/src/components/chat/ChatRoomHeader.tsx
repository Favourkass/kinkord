import Image from "next/image";
import { ChevronLeft, MoreVertical, Users } from "lucide-react";
import type { ConversationVM } from "@/domain/chat";

export interface ChatRoomHeaderProps {
  conversation: ConversationVM;
  onBack: () => void;
  onMoreClick?: () => void;
}

export default function ChatRoomHeader({
  conversation,
  onBack,
  onMoreClick,
}: ChatRoomHeaderProps) {
  const { name, avatarUrl, isOnline, type } = conversation;

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-white/5 bg-[#0d0d0e]/95 px-3 backdrop-blur-md">
      {/* Back button + Avatar + Name & Status */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="grid size-9 place-items-center text-kink-gold-bright transition hover:brightness-110 active:scale-95"
        >
          <ChevronLeft className="size-6" />
        </button>

        {/* Contact Avatar */}
        <div className="relative shrink-0">
          {type === "group" ? (
            <div className="grid size-10 place-items-center rounded-full bg-[#6834d4] text-white">
              <Users className="size-5" />
            </div>
          ) : avatarUrl ? (
            <div className="relative size-10 overflow-hidden rounded-full ring-1 ring-white/10">
              <Image
                src={avatarUrl}
                alt={name}
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="grid size-10 place-items-center rounded-full bg-zinc-800 text-zinc-300 font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          {type !== "group" && (
            <span
              className={`absolute bottom-0 right-0 size-2.5 rounded-full border border-black ${
                isOnline ? "bg-[#34c759]" : "bg-[#636366]"
              }`}
            />
          )}
        </div>

        {/* Name and online status */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[16px] font-bold leading-tight text-white">
              {name}
            </h2>
            {isOnline && type !== "group" && (
              <span className="size-2 rounded-full bg-[#34c759]" />
            )}
          </div>
          <span className="text-[12px] italic text-[#34c759]">
            {isOnline ? "online" : "offline"}
          </span>
        </div>
      </div>

      {/* More Options button */}
      <button
        type="button"
        onClick={onMoreClick}
        aria-label="Conversation menu"
        className="grid size-9 place-items-center text-kink-gold-bright transition hover:brightness-110"
      >
        <MoreVertical className="size-5" />
      </button>
    </header>
  );
}
