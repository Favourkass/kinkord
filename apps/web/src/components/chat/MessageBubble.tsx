import type { ThreadMessageVM } from "@/domain/chat";

export interface MessageBubbleProps {
  message: ThreadMessageVM;
  retryLabel: string;
  onRetry?: (clientId: string) => void;
}

export default function MessageBubble({ message, retryLabel, onRetry }: MessageBubbleProps) {
  const own = message.isOwn;
  return (
    <li className={`flex ${own ? "justify-end" : "justify-start"} px-[20px] py-[3px]`}>
      <div
        className={`max-w-[78%] rounded-[16px] px-[14px] py-[8px] text-[14px] leading-[20px] ${
          own
            ? "rounded-br-[4px] bg-kink-gold-bright text-kink-ink"
            : "rounded-bl-[4px] bg-app-input text-app-text"
        }`}
      >
        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        <p
          className={`pt-[4px] text-right text-[10px] ${
            own ? "text-kink-ink/60" : "text-app-muted"
          }`}
        >
          {message.status === "sending" ? "sending…" : message.time}
        </p>
        {message.status === "failed" && (
          <button
            type="button"
            onClick={() => message.clientId && onRetry?.(message.clientId)}
            className="pt-[4px] text-[11px] font-semibold text-[#e5484d]"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </li>
  );
}
