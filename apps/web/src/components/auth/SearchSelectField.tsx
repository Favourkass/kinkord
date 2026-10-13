"use client";

import { useId, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

interface Props {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string; icon?: string }[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  error?: string;
  disabled?: boolean;
  boldLabel?: boolean;
}

/** Searchable display options with keyboard selection and focus dismissal. */
export default function SearchSelectField(p: Props) {
  const autoId = useId();
  const id = p.id ?? autoId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const hits = p.options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selected = p.options.find((option) => option.value === p.value);
  const choose = (value: string) => {
    p.onChange(value);
    setOpen(false);
    document.getElementById(id)?.focus();
  };
  return (
    <div
      className="relative w-full"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id} className="mb-2 block text-[12px] font-medium text-white lg:text-[20px]">
        {p.label}
      </label>
      <button
        id={id}
        type="button"
        disabled={p.disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-describedby={p.error ? `${id}-error` : undefined}
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setActive(0);
        }}
        className={`flex h-[44px] w-full items-center justify-between rounded-lg border bg-kink-field px-4 text-left text-[15px] text-white focus:border-kink-gold-bright lg:h-[65px] lg:text-[20px] ${p.error ? "border-red-500/70" : "border-kink-edge"}`}
      >
        <span className="flex items-center gap-3">
          {selected?.icon && (
            <span aria-hidden className="text-[24px] leading-none">
              {selected.icon}
            </span>
          )}
          <span className={p.boldLabel ? "font-bold" : undefined}>
            {selected?.label ?? p.placeholder}
          </span>
        </span>
        <ChevronDown size={18} aria-hidden />
      </button>
      {open && (
        <div className="absolute top-full z-30 mt-2 w-full rounded-xl border border-kink-edge bg-kink-field p-2 shadow-xl">
          <div className="mb-2 flex items-center gap-2 border-b border-kink-edge px-2 py-2">
            <Search size={16} aria-hidden className="text-kink-gold-bright" />
            <input
              autoFocus
              role="combobox"
              aria-label={p.searchPlaceholder}
              aria-expanded="true"
              aria-controls={`${id}-options`}
              aria-autocomplete="list"
              aria-activedescendant={hits[active] ? `${id}-option-${active}` : undefined}
              placeholder={p.searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                  document.getElementById(id)?.focus();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive(Math.min(active + 1, hits.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(Math.max(active - 1, 0));
                }
                if (e.key === "Enter" && hits[active]) {
                  e.preventDefault();
                  choose(hits[active].value);
                }
              }}
              className="w-full bg-transparent text-[15px] text-white outline-none"
            />
          </div>
          <div
            role="listbox"
            id={`${id}-options`}
            aria-label={p.label}
            className="max-h-[240px] overflow-y-auto"
          >
            {hits.map((option, index) => (
              <button
                type="button"
                role="option"
                key={option.value}
                id={`${id}-option-${index}`}
                aria-selected={option.value === p.value}
                onClick={() => choose(option.value)}
                className={`block w-full rounded-lg px-3 py-3 text-left text-[15px] hover:bg-kink-gold-bright/10 ${option.value === p.value || index === active ? "bg-kink-gold-bright/10 text-kink-gold-bright" : "text-white"}`}
              >
                <span className="flex items-center gap-3">
                  {option.icon && (
                    <span aria-hidden className="text-[24px] leading-none">
                      {option.icon}
                    </span>
                  )}
                  <span className={p.boldLabel ? "font-bold" : undefined}>{option.label}</span>
                </span>
              </button>
            ))}
            {!hits.length && <p className="p-3 text-[13px] text-kink-help">{p.emptyLabel}</p>}
          </div>
        </div>
      )}
      {p.error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-[11px] text-red-400 lg:text-[16px]"
        >
          {p.error}
        </p>
      )}
    </div>
  );
}
