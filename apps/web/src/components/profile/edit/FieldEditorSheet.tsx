import { useState } from "react";
import type { EditorDraft } from "@/domain/profile";

export interface EditorOptionVM {
  value: string;
  label: string;
  help?: string;
}

export type EditorVM =
  | { kind: "text"; maxLength: number; placeholder: string; prefix?: string }
  | { kind: "textarea"; maxLength: number; placeholder: string }
  | { kind: "single"; options: EditorOptionVM[]; searchable: boolean }
  | { kind: "multi"; options: EditorOptionVM[]; max: number; searchable: boolean }
  | { kind: "date"; max: string }
  | {
      kind: "links";
      fields: { key: "facebook" | "x"; label: string; placeholder: string }[];
    };

export interface FieldEditorSheetProps {
  title: string;
  help: string | null;
  /** 30-day lock notice; when set the field is read-only. */
  lockMessage: string | null;
  editor: EditorVM;
  draft: EditorDraft;
  onDraft: (draft: EditorDraft) => void;
  error: string | null;
  saving: boolean;
  canSave: boolean;
  labels: {
    save: string;
    cancel: string;
    saving: string;
    close: string;
    search: string;
    /** "3/10 selected" for multi pickers. */
    selected: string | null;
  };
  onSave: () => void;
  onCancel: () => void;
}

const field =
  "w-full rounded-[12px] border border-pf-input-border bg-pf-input px-[14px] text-[15px] text-pf-text outline-none placeholder:text-pf-muted focus:border-kink-gold-bright disabled:opacity-60";

/** Bottom sheet (centered dialog on desktop) that edits one profile row. */
export default function FieldEditorSheet(p: FieldEditorSheetProps) {
  const [query, setQuery] = useState("");
  const locked = p.lockMessage !== null;
  const q = query.trim().toLowerCase();
  const matches = (o: EditorOptionVM) => !q || o.label.toLowerCase().includes(q);

  const search =
    (p.editor.kind === "single" || p.editor.kind === "multi") && p.editor.searchable ? (
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={p.labels.search}
        aria-label={p.labels.search}
        className={`${field} mb-[10px] h-[42px]`}
      />
    ) : null;

  let body: React.ReactNode = null;
  const { editor, draft } = p;
  if (editor.kind === "text" && draft.kind === "text") {
    body = (
      <div className="flex items-center gap-[6px]">
        {editor.prefix ? (
          <span className="text-[15px] font-semibold text-pf-muted">{editor.prefix}</span>
        ) : null}
        <input
          value={draft.value}
          maxLength={editor.maxLength}
          placeholder={editor.placeholder}
          disabled={locked}
          autoFocus
          onChange={(e) => p.onDraft({ kind: "text", value: e.target.value })}
          className={`${field} h-[44px]`}
        />
      </div>
    );
  } else if (editor.kind === "textarea" && draft.kind === "textarea") {
    body = (
      <div>
        <textarea
          value={draft.value}
          rows={5}
          maxLength={editor.maxLength}
          placeholder={editor.placeholder}
          autoFocus
          onChange={(e) => p.onDraft({ kind: "textarea", value: e.target.value })}
          className={`${field} py-[10px]`}
        />
        <p className="pt-[4px] text-right text-[11px] text-pf-muted">
          {draft.value.length}/{editor.maxLength}
        </p>
      </div>
    );
  } else if (editor.kind === "date" && draft.kind === "date") {
    body = (
      <input
        type="date"
        value={draft.value}
        max={editor.max}
        onChange={(e) => p.onDraft({ kind: "date", value: e.target.value })}
        className={`${field} h-[44px]`}
      />
    );
  } else if (editor.kind === "single" && draft.kind === "single") {
    body = (
      <div role="listbox" aria-label={p.title} className="flex flex-col">
        {editor.options.filter(matches).map((o) => {
          const selected = o.value === draft.value;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => p.onDraft({ kind: "single", value: o.value })}
              className={`flex min-h-[46px] w-full items-center justify-between gap-[12px] border-b border-pf-divider py-[10px] text-left last:border-b-0 ${
                selected ? "text-kink-gold-bright" : "text-pf-text"
              }`}
            >
              <span className="flex min-w-0 flex-col">
                <span className={`text-[14px] ${selected ? "font-bold" : "font-medium"}`}>
                  {o.label}
                </span>
                {o.help ? <span className="text-[11px] text-pf-muted">{o.help}</span> : null}
              </span>
              <span
                aria-hidden
                className={`size-[18px] shrink-0 rounded-full border-2 ${
                  selected ? "border-kink-gold-bright bg-kink-gold-bright" : "border-pf-muted"
                }`}
              />
            </button>
          );
        })}
      </div>
    );
  } else if (editor.kind === "multi" && draft.kind === "multi") {
    const toggle = (value: string) =>
      p.onDraft({
        kind: "multi",
        value: draft.value.includes(value)
          ? draft.value.filter((v) => v !== value)
          : [...draft.value, value],
      });
    body = (
      <div className="flex flex-wrap gap-[8px]">
        {editor.options.filter(matches).map((o) => {
          const on = draft.value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              className={`rounded-full border px-[12px] py-[6px] text-[12px] font-semibold ${
                on
                  ? "border-kink-gold-bright bg-kink-gold-bright/10 text-kink-gold-bright"
                  : "border-pf-border bg-pf-surface text-pf-muted"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  } else if (editor.kind === "links" && draft.kind === "links") {
    body = (
      <div className="flex flex-col gap-[12px]">
        {editor.fields.map((f) => (
          <label key={f.key} className="block">
            <span className="block pb-[4px] text-[12px] font-semibold text-pf-text">{f.label}</span>
            <input
              type="url"
              inputMode="url"
              value={draft.value[f.key]}
              placeholder={f.placeholder}
              onChange={(e) =>
                p.onDraft({ kind: "links", value: { ...draft.value, [f.key]: e.target.value } })
              }
              className={`${field} h-[44px]`}
            />
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label={p.labels.close}
        onClick={p.onCancel}
        className="absolute inset-0 bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[24px] border-t border-pf-border bg-pf-sheet px-[20px] pb-[max(16px,env(safe-area-inset-bottom))] pt-[18px] lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-[460px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[24px] lg:border"
      >
        <p className="text-[16px] font-bold text-pf-text">{p.title}</p>
        {p.help ? <p className="pt-[4px] text-[12px] text-pf-muted">{p.help}</p> : null}
        {p.lockMessage ? (
          <p className="pt-[6px] text-[12px] italic text-kink-gold-bright">{p.lockMessage}</p>
        ) : null}
        <div className="mt-[14px] min-h-0 flex-1 overflow-y-auto">
          {search}
          {body}
        </div>
        {p.labels.selected ? (
          <p className="pt-[8px] text-[11px] text-pf-muted">{p.labels.selected}</p>
        ) : null}
        {p.error ? (
          <p className="pt-[8px] text-[12px] font-semibold text-red-500">{p.error}</p>
        ) : null}
        <div className="flex gap-[10px] pt-[14px]">
          <button
            type="button"
            onClick={p.onCancel}
            className="h-[44px] flex-1 rounded-[12px] border border-pf-border text-[14px] font-semibold text-pf-text"
          >
            {p.labels.cancel}
          </button>
          <button
            type="button"
            onClick={p.onSave}
            disabled={!p.canSave || p.saving || locked}
            className="h-[44px] flex-1 rounded-[12px] bg-kink-gold-bright text-[14px] font-bold text-black disabled:opacity-50"
          >
            {p.saving ? p.labels.saving : p.labels.save}
          </button>
        </div>
      </div>
    </div>
  );
}
