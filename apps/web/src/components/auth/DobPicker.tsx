"use client";

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

function Wheel<T extends number>({
  items,
  render,
  value,
  onSelect,
  ariaLabel,
}: {
  items: T[];
  render: (v: T) => string;
  value: T | null;
  onSelect: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="relative h-56 flex-1 overflow-y-auto rounded-[12px] border border-kink-edge bg-kink-field py-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="listbox"
      aria-label={ariaLabel}
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
                ? "border-y-[1.5px] border-kink-gold-bright text-[17px] font-bold text-kink-gold-bright"
                : "text-[15px] text-white/85 hover:text-white"
            }`}
          >
            {render(item)}
          </button>
        );
      })}
    </div>
  );
}

/** Three-column date-of-birth picker, per the "Tell us about you" frame. */
export default function DobPicker({ day, month, year, onChange, error }: Props) {
  const now = new Date().getFullYear();
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: now - 1900 - 17 }, (_, i) => 1900 + i);

  return (
    <div className="w-full">
      <p className="mb-2 text-[12px] font-medium text-white lg:text-[20px]">Date of birth</p>
      <div className="flex gap-3">
        <Wheel
          items={days}
          render={String}
          value={day}
          ariaLabel="Day"
          onSelect={(d) => onChange({ day: d, month, year })}
        />
        <Wheel
          items={months}
          render={(m) => MONTHS[m - 1]}
          value={month}
          ariaLabel="Month"
          onSelect={(m) => onChange({ day, month: m, year })}
        />
        <Wheel
          items={years}
          render={String}
          value={year}
          ariaLabel="Year"
          onSelect={(y) => onChange({ day, month, year: y })}
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
