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
    <li className={`flex ${own ? "justify-end" : "justify-start"} px-[20px] py-[3px]`}>
      <div
        className={`max-w-[78%] rounded-[16px] text-[14px] leading-[20px] ${
          photo ? "px-[4px] pb-[8px] pt-[4px]" : "px-[14px] py-[8px]"
        } ${
          own
            ? "rounded-br-[4px] bg-kink-gold-bright text-kink-ink"
            : "rounded-bl-[4px] bg-app-input text-app-text"
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
        {message.body && (
          <p className={`whitespace-pre-wrap break-words ${photo ? "px-[10px] pt-[6px]" : ""}`}>
            {message.body}
          </p>
        )}
        <p
          className={`pt-[4px] text-right text-[10px] ${
            own ? "text-kink-ink/60" : "text-app-muted"
          } ${photo ? "px-[10px]" : ""}`}
        >
          {message.status === "sending" ? "sending…" : message.time}
        </p>
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
