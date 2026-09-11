import { Camera, MoreVertical } from "lucide-react";

export interface ChatListHeaderProps {
  brand?: string;
  onCameraClick?: () => void;
  onMoreClick?: () => void;
}

/** Top bar for the conversation list: brand logo, camera button, more button. */
export default function ChatListHeader({
  brand = "KINKORD",
  onCameraClick,
  onMoreClick,
}: ChatListHeaderProps) {
  return (
    <header className="flex h-[56px] items-center justify-between px-4">
      <h1 className="text-[20px] font-extrabold tracking-[2px] text-kink-gold-bright">{brand}</h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCameraClick}
          aria-label="Camera"
          className="grid size-9 place-items-center text-[#d1d1d6] transition hover:text-white"
        >
          <Camera className="size-5" />
        </button>
        <button
          type="button"
          onClick={onMoreClick}
          aria-label="More options"
          className="grid size-9 place-items-center text-kink-gold-bright transition hover:brightness-110"
        >
          <MoreVertical className="size-5" />
        </button>
      </div>
    </header>
  );
}
