"use client";

import { useEffect, useId } from "react";
import type { AdminDialogVM } from "@/presenters/useAdminMemberPresenter";

export interface ConfirmDialogProps {
  dialog: AdminDialogVM;
}

/** A bottom sheet on phones, a centred dialog on wider screens. */
export default function ConfirmDialog({ dialog }: ConfirmDialogProps) {
  const titleId = useId();
  const { cancel } = dialog;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center"
      onClick={cancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-t-[20px] border border-app-card-border bg-app-card p-[20px] md:rounded-[20px]"
      >
        <h2 id={titleId} className="text-[18px] font-bold text-app-value">
          {dialog.title}
        </h2>
        <p className="pt-[8px] text-[14px] leading-[20px] text-app-subtle">{dialog.body}</p>

        {dialog.checkbox ? (
          <label className="flex items-start gap-[10px] pt-[16px] text-[14px] text-app-value">
            <input
              type="checkbox"
              checked={dialog.checkbox.checked}
              onChange={dialog.checkbox.toggle}
              className="mt-[2px] h-[18px] w-[18px] accent-kink-amber"
            />
            <span>{dialog.checkbox.label}</span>
          </label>
        ) : null}

        {dialog.reason ? (
          <label className="block pt-[16px] text-[13px] font-bold text-app-text">
            {dialog.reason.label}
            <textarea
              value={dialog.reason.value}
              onChange={(e) => dialog.reason?.set(e.target.value)}
              rows={2}
              maxLength={300}
              className="mt-[6px] w-full rounded-[12px] border border-app-input-border bg-app-input p-[10px] text-[15px] font-normal text-app-value focus:border-kink-amber focus:outline-none"
            />
          </label>
        ) : null}

        {dialog.typeToConfirm ? (
          <label className="block pt-[16px] text-[13px] font-bold text-app-text">
            {dialog.typeToConfirm.label}
            <input
              value={dialog.typeToConfirm.value}
              onChange={(e) => dialog.typeToConfirm?.set(e.target.value)}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-[6px] h-[44px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[10px] text-[15px] font-normal text-app-value focus:border-app-danger focus:outline-none"
            />
          </label>
        ) : null}

        {dialog.error ? (
          <p className="pt-[12px] text-[14px] text-app-danger">{dialog.error}</p>
        ) : null}

        <div className="flex flex-col-reverse gap-[10px] pt-[20px] md:flex-row md:justify-end">
          <button
            type="button"
            onClick={cancel}
            disabled={dialog.busy}
            autoFocus={!dialog.typeToConfirm}
            className="h-[46px] rounded-[12px] border border-app-input-border bg-app-input px-[18px] text-[15px] font-bold text-app-value disabled:opacity-50"
          >
            {dialog.cancelLabel}
          </button>
          <button
            type="button"
            onClick={dialog.confirm}
            disabled={!dialog.canConfirm}
            className={`h-[46px] rounded-[12px] px-[18px] text-[15px] font-bold disabled:opacity-40 ${
              dialog.destructive ? "bg-app-danger text-white" : "bg-kink-amber text-black"
            }`}
          >
            {dialog.busy ? "…" : dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
