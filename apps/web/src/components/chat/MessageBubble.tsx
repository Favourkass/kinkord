import MessageReceipt from "./MessageReceipt";
import type { ThreadMessageVM } from "@/domain/chat";

export interface MessageBubblePhotoLabels {
  alt: string;
  /** On a blurred photo: what a tap does. */
  reveal: string;
  open: string;
}

export interface MessageBubbleProps {
  message: ThreadMessageVM;
  retryLabel: string;
  onRetry?: (clientId: string) => void;
  photoLabels: MessageBubblePhotoLabels;
  onRevealPhoto?: (messageId: string) => void;
  onOpenPhoto?: (src: string) => void;
}

export default function MessageBubble({
  message,
  retryLabel,
  onRetry,
  photoLabels,
  onRevealPhoto,
  onOpenPhoto,
}: MessageBubbleProps) {
  const own = message.isOwn;
  const photo = message.photo;
  return (
    <li className={`flex ${own ? "justify-end" : "justify-start"} px-[16px] py-[3px]`}>
      <div
        className={`relative max-w-[85%] rounded-[9px] text-[15px] leading-[21px] shadow-sm after:absolute after:top-0 after:size-[9px] ${
          photo ? "px-[4px] pb-[8px] pt-[4px]" : "px-[10px] py-[7px]"
        } ${
          own
            ? "rounded-tr-none bg-[#3b3019] text-[#fff8e7] after:-right-[7px] after:bg-[#3b3019] after:[clip-path:polygon(0_0,100%_0,0_100%)]"
            : "rounded-tl-none bg-[#1b1b1b] text-app-text after:-left-[7px] after:bg-[#1b1b1b] after:[clip-path:polygon(0_0,100%_0,100%_100%)]"
        }`}
      >
        {photo && (
          <button
            type="button"
            onClick={() => {
              if (photo.hidden) onRevealPhoto?.(message.id);
              else if (photo.fullSrc) onOpenPhoto?.(photo.fullSrc);
            }}
            aria-label={photo.hidden ? photoLabels.reveal : photoLabels.open}
            className="relative block size-[220px] max-w-full overflow-hidden rounded-[12px] bg-black/20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable */}
            <img
              src={photo.src}
              alt={photoLabels.alt}
              className={`size-full object-cover ${photo.hidden ? "scale-110 blur-[20px]" : ""}`}
            />
            {photo.hidden && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="rounded-full bg-black/60 px-[12px] py-[6px] text-[12px] font-semibold text-white">
                  {photoLabels.reveal}
                </span>
              </span>
            )}
          </button>
        )}
        <div className={`flow-root ${photo ? "px-[6px] pt-[6px]" : ""}`}>
          {message.body && (
            <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.body}</span>
          )}
          <span className="float-right ml-[10px] mt-[5px] inline-flex items-center gap-[4px] text-[11px] leading-[16px] text-white/55">
            {message.status === "sending" ? "sending…" : message.time}
            {own &&
              (message.status === "sent" ||
                message.status === "delivered" ||
                message.status === "seen") && <MessageReceipt status={message.status} />}
          </span>
        </div>
        {message.status === "failed" && (
          <button
            type="button"
            onClick={() => message.clientId && onRetry?.(message.clientId)}
            className={`pt-[4px] text-[11px] font-semibold text-app-danger ${photo ? "px-[10px]" : ""}`}
          >
            {retryLabel}
          </button>
        )}
      </div>
    </li>
  );
}
