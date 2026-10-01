"use client";

export interface PushPromptProps {
  text: string;
  /** Null when there's nothing to tap yet (iPhone: install first). */
  actionLabel: string | null;
  dismissLabel: string;
  busy: boolean;
  onAction: () => void;
  onDismiss: () => void;
}

/** The "turn on notifications" card at the top of the inbox. */
export default function PushPrompt(p: PushPromptProps) {
  return (
    <div className="flex items-center gap-[12px] border-b border-app-line bg-app-surface px-[20px] py-[12px]">
      <p className="min-w-0 flex-1 text-[13px] text-app-text">{p.text}</p>
      {p.actionLabel && (
        <button
          type="button"
          onClick={p.onAction}
          disabled={p.busy}
          className="shrink-0 rounded-full bg-kink-amber px-[14px] py-[7px] text-[13px] font-bold text-black disabled:opacity-60"
        >
          {p.actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={p.onDismiss}
        className="shrink-0 text-[13px] text-app-muted hover:underline"
      >
        {p.dismissLabel}
      </button>
    </div>
  );
}
