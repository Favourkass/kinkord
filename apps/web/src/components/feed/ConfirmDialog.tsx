export interface ConfirmDialogProps {
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small yes/no gate in front of anything that cannot be undone. */
export default function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[130] grid place-items-center bg-black/60 p-[24px]"
    >
      <div className="w-full max-w-[340px] rounded-[16px] bg-feed-sheet p-[20px]">
        <p className="text-[15px] leading-[22px] text-feed-text">{message}</p>
        <div className="flex justify-end gap-[10px] pt-[18px]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[8px] px-[16px] py-[8px] text-[14px] font-medium text-feed-muted"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-[8px] bg-[#e5484d] px-[16px] py-[8px] text-[14px] font-bold text-white disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
