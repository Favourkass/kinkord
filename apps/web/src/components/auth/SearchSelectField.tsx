"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { optionMatcher, type SearchResult } from "@/util/textSearch";

interface Option {
  value: string;
  label: string;
  icon?: string;
}

/** A last row pinned under every search, for a value the list lacks. */
export interface SearchSelectOther {
  /** Picked as is when nothing is typed. */
  value: string;
  label: string;
  /** The row once something is typed: Use “Ikota”. */
  typedLabel: (query: string) => string;
  /** Picks the typed text itself. */
  onTyped: (text: string) => void;
}

interface Props {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  /** Under a list cut short at the first matches. */
  moreLabel?: string;
  /** Override the default cap for small, complete lists such as states. */
  resultLimit?: number;
  /** Reveal the entire list in batches as the member scrolls. */
  loadMoreOnScroll?: boolean;
  other?: SearchSelectOther | null;
  error?: string;
  disabled?: boolean;
  boldLabel?: boolean;
}

const NOTHING: SearchResult<Option> = { hits: [], more: false };
const SCROLL_BATCH_SIZE = 50;

/** Searchable display options with keyboard selection and focus dismissal. */
export default function SearchSelectField(p: Props) {
  const autoId = useId();
  const id = p.id ?? autoId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(SCROLL_BATCH_SIZE);
  const limit = p.loadMoreOnScroll ? visibleLimit : p.resultLimit;
  // Long lists (thousands of towns) are only searched while open.
  const match = useMemo(() => (open ? optionMatcher(p.options) : null), [open, p.options]);
  const { hits, more } = useMemo(
    () => (match ? match(query, limit) : NOTHING),
    [match, query, limit],
  );
  const other = p.other ?? null;
  const typed = query.trim();
  const rows = hits.length + (other ? 1 : 0);
  const selected: Option | undefined =
    p.options.find((option) => option.value === p.value) ??
    (other && other.value === p.value ? { value: other.value, label: other.label } : undefined);
  const close = () => {
    setOpen(false);
    document.getElementById(id)?.focus();
  };
  const choose = (value: string) => {
    p.onChange(value);
    close();
  };
  const chooseOther = () => {
    if (!other) return;
    if (typed) other.onTyped(typed);
    else p.onChange(other.value);
    close();
  };
  const pick = (index: number) => (index < hits.length ? choose(hits[index].value) : chooseOther());
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
          setVisibleLimit(SCROLL_BATCH_SIZE);
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
              aria-activedescendant={active < rows ? `${id}-option-${active}` : undefined}
              placeholder={p.searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setVisibleLimit(SCROLL_BATCH_SIZE);
                const list = document.getElementById(`${id}-options`);
                if (list) list.scrollTop = 0;
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (p.loadMoreOnScroll && more && active + 1 >= hits.length) {
                    setVisibleLimit((count) => count + SCROLL_BATCH_SIZE);
                    setActive(active + 1);
                  } else {
                    setActive(Math.max(0, Math.min(active + 1, rows - 1)));
                  }
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(Math.max(active - 1, 0));
                }
                if (e.key === "Enter" && active < rows) {
                  e.preventDefault();
                  pick(active);
                }
              }}
              className="w-full bg-transparent text-[15px] text-white outline-none"
            />
          </div>
          <div
            role="listbox"
            id={`${id}-options`}
            aria-label={p.label}
            // iOS Safari doesn't focus a tapped button, so without this the search
            // box's blur closes the list before the tap lands on an option.
            onMouseDown={(e) => e.preventDefault()}
            onScroll={(e) => {
              const list = e.currentTarget;
              if (
                p.loadMoreOnScroll &&
                more &&
                list.scrollHeight - list.scrollTop - list.clientHeight < 120
              ) {
                setVisibleLimit((count) => count + SCROLL_BATCH_SIZE);
              }
            }}
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
            {more && p.moreLabel && (
              <p className="px-3 py-2 text-[12px] text-kink-help">{p.moreLabel}</p>
            )}
            {other && (
              <button
                type="button"
                role="option"
                id={`${id}-option-${hits.length}`}
                aria-selected={!typed && other.value === p.value}
                onClick={chooseOther}
                className={`sticky bottom-0 block w-full border-t border-kink-edge bg-kink-field px-3 py-3 text-left text-[15px] font-semibold ${
                  (!typed && other.value === p.value) || active === hits.length
                    ? "text-kink-gold-bright"
                    : "text-white"
                }`}
              >
                {typed ? other.typedLabel(typed) : other.label}
              </button>
            )}
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
