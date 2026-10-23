"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

interface Props {
  label: string;
  max: number;
  selected: readonly string[];
  options: readonly string[];
  query: string;
  searchLabel: string;
  onQuery: (query: string) => void;
  onToggle: (value: string) => void;
}

/** Display-ready choices and removable selections; the presenter owns the draft. */
export default function MultiSelectField(p: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          document.getElementById(`${id}-toggle`)?.focus();
        }
      }}
    >
      <p id={`${id}-label`} className="mb-2 text-[15px] text-white lg:text-[20px]">
        {p.label} <span className="text-kink-help">(max {p.max})</span>
      </p>
      <div className="flex min-h-[52px] items-center gap-2 rounded-lg border border-kink-edge bg-kink-field p-2">
        <div className="flex flex-1 flex-wrap gap-2">
          {p.selected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded bg-black px-3 py-2 text-[14px] text-kink-cream"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => p.onToggle(value)}
                className="rounded p-1 text-kink-help hover:text-kink-gold-bright"
              >
                <X size={16} aria-hidden />
              </button>
            </span>
          ))}
          {!p.selected.length && (
            <span className="px-2 py-2 text-[14px] text-kink-help">Select options</span>
          )}
        </div>
        <button
          id={`${id}-toggle`}
          type="button"
          aria-label={p.label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          className="self-stretch rounded px-3 text-kink-gold-bright"
          onClick={() => setOpen(!open)}
        >
          <ChevronDown size={22} aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-[12px] text-kink-help" aria-live="polite">
        {p.selected.length} / {p.max} selected
      </p>
      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-lg border border-kink-edge bg-kink-field p-2 shadow-xl">
          <input
            autoFocus
            type="search"
            aria-label={p.searchLabel}
            placeholder={p.searchLabel}
            value={p.query}
            onChange={(event) => p.onQuery(event.target.value)}
            className="mb-2 h-11 w-full rounded border border-kink-edge bg-black px-3 text-white outline-none focus:border-kink-gold-bright"
          />
          <div
            id={`${id}-options`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            aria-multiselectable="true"
            className="max-h-[260px] overflow-y-auto overscroll-contain"
          >
            {p.options.map((value) => {
              const selected = p.selected.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={!selected && p.selected.length >= p.max}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => p.onToggle(value)}
                  className="flex min-h-11 w-full items-center gap-3 rounded px-3 py-2 text-left text-[14px] text-white hover:bg-black disabled:opacity-40"
                >
                  <span
                    aria-hidden
                    className={`grid size-5 shrink-0 place-items-center rounded border ${selected ? "border-kink-gold-bright bg-kink-gold-bright text-black" : "border-kink-help"}`}
                  >
                    {selected && <Check size={15} />}
                  </span>
                  {value}
                </button>
              );
            })}
            {!p.options.length && <p className="p-3 text-kink-help">No matching options.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
