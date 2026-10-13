"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { AdminDialogVM } from "@/presenters/useAdminMemberPresenter";

export interface ConfirmDialogProps {
  dialog: AdminDialogVM;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const field =
  "mt-[6px] h-[44px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[10px] text-[15px] font-normal text-app-value focus:outline-none";

/** A bottom sheet on phones, a centred dialog on wider screens. */
export default function ConfirmDialog({ dialog }: ConfirmDialogProps) {
  const titleId = useId();
  const { cancel } = dialog;
  const boxRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const phraseRef = useRef<HTMLInputElement>(null);
  // Read while rendering, before focus moves into the dialog: whatever opened it.
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );

  // Start on Cancel (or the phrase to type), and hand focus back to the opener on close.
  useEffect(() => {
    (phraseRef.current ?? cancelRef.current)?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  // Esc cancels; Tab wraps at either end rather than walking into the page behind.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancel();
        return;
      }
      const box = boxRef.current;
      if (e.key !== "Tab" || !box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = box.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel]);

  // A tap outside only closes it while nothing's typed, so a stray tap can't lose a reason or code.
  const typed = [dialog.input, dialog.reason, dialog.code, dialog.typeToConfirm].some((f) =>
    Boolean(f?.value.trim()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center"
      onClick={typed ? undefined : cancel}
    >
      <div
        ref={boxRef}
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

        {dialog.input ? (
          <label className="block pt-[16px] text-[13px] font-bold text-app-text">
            {dialog.input.label}
            <input
              value={dialog.input.value}
              onChange={(e) => dialog.input?.set(e.target.value)}
              maxLength={256}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`${field} focus:border-kink-amber`}
            />
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

        {dialog.code ? (
          <label className="block pt-[16px] text-[13px] font-bold text-app-text">
            {dialog.code.label}
            {/* No maxLength: the presenter keeps six digits, after dropping spaces from a paste. */}
            <input
              value={dialog.code.value}
              onChange={(e) => dialog.code?.set(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${field} font-mono tracking-[0.2em] focus:border-kink-amber`}
            />
          </label>
        ) : null}

        {dialog.typeToConfirm ? (
          <label className="block pt-[16px] text-[13px] font-bold text-app-text">
            {dialog.typeToConfirm.label}
            <input
              ref={phraseRef}
              value={dialog.typeToConfirm.value}
              onChange={(e) => dialog.typeToConfirm?.set(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`${field} focus:border-app-danger`}
            />
          </label>
        ) : null}

        {dialog.error ? (
          <p role="alert" className="pt-[12px] text-[14px] text-app-danger">
            {dialog.error}
            {dialog.errorLink ? (
              <>
                {" "}
                <Link
                  href={dialog.errorLink.href}
                  className="font-bold underline underline-offset-4"
                >
                  {dialog.errorLink.label}
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-[10px] pt-[20px] md:flex-row md:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            disabled={dialog.busy}
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
