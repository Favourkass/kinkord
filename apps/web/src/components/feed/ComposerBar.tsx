import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";

export interface ComposerBarProps {
  avatarUrl: string | null;
  placeholder: string;
  openLabel: string;
  photoLabel: string;
  onOpen: () => void;
  /** Opens the composer with the file picker already showing. */
  onOpenWithPhoto: () => void;
}

/**
 * The "What's on your mind?" row (Figma 800:488–800:492): 40px avatar on the
 * gold ring, a rounded outline field, and the photo shortcut at the far right.
 * The field is a button, not an input — typing happens in the dialog.
 */
export default function ComposerBar({
  avatarUrl,
  placeholder,
  openLabel,
  photoLabel,
  onOpen,
  onOpenWithPhoto,
}: ComposerBarProps) {
  return (
    <div className="flex items-center gap-[8px] border-b border-feed-line px-[25px] py-[20px]">
      <AvatarCircle src={avatarUrl} alt="" size={40} ringClassName="bg-kink-gold-bright" />
      <button
        type="button"
        onClick={onOpen}
        aria-label={openLabel}
        className="ml-[6px] h-[30px] flex-1 rounded-[15px] border border-feed-line px-[17px] text-left text-[14px] font-medium text-feed-text"
      >
        {placeholder}
      </button>
      <button
        type="button"
        onClick={onOpenWithPhoto}
        aria-label={photoLabel}
        className="shrink-0 text-feed-text transition-opacity hover:opacity-70"
      >
        <MaskIcon src="/app/profile/icon-image-fill.svg" width={19} />
      </button>
    </div>
  );
}
