"use client";

import { useId } from "react";
import type { ReportReason } from "@/domain/safety";

export interface ReportSheetProps {
  title: string;
  intro: string;
  reasons: Array<{ value: ReportReason; label: string }>;
  selected: ReportReason | null;
  details: string;
  detailsLabel: string;
  detailsMax: number;
  /** "Also block them", unless they're blocked already. */
  alsoBlock: { label: string; checked: boolean } | null;
  submitLabel: string;
  cancelLabel: string;
  canSubmit: boolean;
  sent: boolean;
  doneText: string;
  closeLabel: string;
  error: string | null;
  onReason: (reason: ReportReason) => void;
  onDetails: (details: string) => void;
  onToggleBlock: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

/** Reporting the other member: pick a reason, add a note if there's more, send. */
export default function ReportSheet(p: ReportSheetProps) {
  // Its own radio group: the app shell renders a page twice (phone and
  // desktop), and two sheets sharing one name would be one group, so the
  // hidden copy would take the choice from the one being tapped.
  const group = useId();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      onClick={p.onClose}
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center sm:p-[24px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[20px] bg-app-surface p-[20px] pb-[calc(20px+env(safe-area-inset-bottom))] sm:rounded-[20px]"
      >
        <h2 className="text-[18px] font-bold text-app-text">{p.title}</h2>
        {p.sent ? (
          <>
            <p className="pt-[12px] text-[14px] leading-[21px] text-app-text">{p.doneText}</p>
            <div className="flex justify-end pt-[20px]">
              <button
                type="button"
                onClick={p.onClose}
                className="rounded-full bg-kink-gold-bright px-[18px] py-[9px] text-[14px] font-bold text-kink-ink"
              >
                {p.closeLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="pt-[8px] text-[13px] leading-[19px] text-app-muted">{p.intro}</p>
            <fieldset className="pt-[12px]">
              <legend className="sr-only">{p.title}</legend>
              {p.reasons.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-[12px] rounded-[12px] px-[8px] py-[9px] text-[14px] text-app-text hover:bg-app-input"
                >
                  <input
                    type="radio"
                    name={group}
                    value={r.value}
                    checked={p.selected === r.value}
                    onChange={() => p.onReason(r.value)}
                    className="size-[18px] shrink-0 accent-kink-gold-bright"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label className="block pt-[10px] text-[13px] text-app-muted">
              {p.detailsLabel}
              <textarea
                value={p.details}
                maxLength={p.detailsMax}
                rows={3}
                onChange={(e) => p.onDetails(e.target.value)}
                className="mt-[6px] block w-full resize-none rounded-[12px] border border-app-line bg-app-input px-[12px] py-[10px] text-[14px] text-app-text outline-none"
              />
            </label>
            {p.alsoBlock && (
              <label className="flex cursor-pointer items-center gap-[10px] pt-[14px] text-[14px] text-app-text">
                <input
                  type="checkbox"
                  checked={p.alsoBlock.checked}
                  onChange={p.onToggleBlock}
                  className="size-[18px] shrink-0 accent-kink-gold-bright"
                />
                {p.alsoBlock.label}
              </label>
            )}
            {p.error && <p className="pt-[10px] text-[13px] text-app-danger">{p.error}</p>}
            <div className="flex justify-end gap-[10px] pt-[18px]">
              <button
                type="button"
                onClick={p.onClose}
                className="rounded-full px-[16px] py-[9px] text-[14px] font-medium text-app-muted"
              >
                {p.cancelLabel}
              </button>
              <button
                type="button"
                onClick={p.onSubmit}
                disabled={!p.canSubmit}
                className="rounded-full bg-app-danger px-[18px] py-[9px] text-[14px] font-bold text-app-surface disabled:opacity-40"
              >
                {p.submitLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
