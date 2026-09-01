"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface Props {
  day: number | null;
  month: number | null;
  year: number | null;
  onChange: (v: { day: number | null; month: number | null; year: number | null }) => void;
  error?: string;
}

function WheelDropdown<T extends number>({
  items,
  render,
  value,
  onSelect,
  label,
  open,
  onToggle,
}: {
  items: T[];
  render: (v: T) => string;
  value: T | null;
  onSelect: (v: T) => void;
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || value == null) return;
    const selected = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    selected?.scrollIntoView({ block: "center" });
  }, [open, value]);

  return (
    <div className="relative flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex h-[50px] w-full items-center gap-2 rounded-[12px] border bg-kink-field px-3 text-left transition lg:h-[56px] lg:px-4 ${
          open ? "border-kink-amber" : "border-kink-edge"
        }`}
      >
        <Calendar size={16} className="shrink-0 text-kink-help" aria-hidden />
        <span
          className={`truncate text-[13px] lg:text-[16px] ${
            value == null ? "text-kink-help" : "text-white"
          }`}
        >
          {value == null ? label : render(value)}
        </span>
        <ChevronDown
          size={16}
          className={`ml-auto shrink-0 text-kink-help transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          ref={listRef}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-y-auto rounded-[12px] border border-kink-edge bg-kink-field py-1 shadow-[0_16px_40px_rgba(0,0,0,0.55)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="listbox"
          aria-label={label}
        >
          {items.map((item) => {
            const selected = item === value;
            return (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(item)}
                className={`block w-full py-2 text-center transition ${
                  selected
                    ? "border-y-[1.5px] border-kink-gold-bright text-[16px] font-bold text-kink-gold-bright"
                    : "text-[14px] text-white/85 hover:text-white"
                }`}
              >
                {render(item)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Date-of-birth row: three dropdown triggers that open scrollable wheels. */
export default function DobPicker({ day, month, year, onChange, error }: Props) {
  const now = new Date().getFullYear();
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: now - 1900 - 17 }, (_, i) => 1900 + i);
  const [open, setOpen] = useState<"day" | "month" | "year" | null>(null);
  const toggle = (key: "day" | "month" | "year") => setOpen((o) => (o === key ? null : key));

  return (
    <div className="w-full">
      <p className="mb-2 text-[12px] font-medium text-white lg:text-[20px]">Date of birth</p>
      {open ? (
        <button
          type="button"
          aria-label="Close date picker"
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-20 cursor-default"
        />
      ) : null}
      <div className="flex gap-3 lg:gap-4">
        <WheelDropdown
          items={days}
          render={String}
          value={day}
          label="Day"
          open={open === "day"}
          onToggle={() => toggle("day")}
          onSelect={(d) => {
            onChange({ day: d, month, year });
            setOpen(null);
          }}
        />
        <WheelDropdown
          items={months}
          render={(m) => MONTHS[m - 1]}
          value={month}
          label="Month"
          open={open === "month"}
          onToggle={() => toggle("month")}
          onSelect={(m) => {
            onChange({ day, month: m, year });
            setOpen(null);
          }}
        />
        <WheelDropdown
          items={years}
          render={String}
          value={year}
          label="Year"
          open={open === "year"}
          onToggle={() => toggle("year")}
          onSelect={(y) => {
            onChange({ day, month, year: y });
            setOpen(null);
          }}
        />
      </div>
      <p
        className={`mt-1.5 text-[11px] lg:text-[16px] ${error ? "text-red-400" : "text-kink-help"}`}
      >
        {error ?? "You must be 18 years or older to join."}
      </p>
    </div>
  );
}
