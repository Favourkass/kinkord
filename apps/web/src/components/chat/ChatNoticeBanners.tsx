import { Clock, Lock } from "lucide-react";

export interface ChatNoticeBannersProps {
  encryptionVisible?: boolean;
  onLearnMoreEncryption?: () => void;
  disappearingVisible?: boolean;
  disappearingDays?: number;
  onChangeDisappearing?: () => void;
}

export default function ChatNoticeBanners({
  encryptionVisible = true,
  onLearnMoreEncryption,
  disappearingVisible = true,
  disappearingDays = 7,
  onChangeDisappearing,
}: ChatNoticeBannersProps) {
  return (
    <div className="flex flex-col gap-2.5 px-4 pt-3 pb-2">
      {/* End-to-end Encryption Card */}
      {encryptionVisible && (
        <div className="flex items-start gap-3 rounded-2xl bg-[#1a1a1e] p-3.5 border border-white/5 shadow-sm">
          <Lock className="mt-0.5 size-4.5 text-[#9a9aa0] shrink-0" />
          <p className="text-[12.5px] leading-relaxed text-[#c7c7cc]">
            Messages and calls are end-to-end encrypted. No one outside of this chat,
            not even Kinkord, can read or listen to them.{" "}
            <button
              type="button"
              onClick={onLearnMoreEncryption}
              className="font-medium text-kink-gold-bright hover:underline cursor-pointer inline"
            >
              Learn more
            </button>
          </p>
        </div>
      )}

      {/* Disappearing Messages Card */}
      {disappearingVisible && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#1a1a1e] p-3.5 border border-white/5 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="size-4.5 text-[#9a9aa0] shrink-0" />
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-white">
                Disappearing messages
              </span>
              <span className="text-[12px] text-[#8e8e93]">
                Messages will disappear in {disappearingDays} days
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onChangeDisappearing}
            className="text-[13px] font-semibold text-kink-gold-bright transition hover:brightness-110 active:scale-95"
          >
            Change
          </button>
        </div>
      )}
    </div>
  );
}
