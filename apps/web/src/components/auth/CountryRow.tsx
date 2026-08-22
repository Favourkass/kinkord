"use client";

interface Props {
  flag: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
}

/** Country option row with trailing radio, per the country-selection frame. */
export default function CountryRow({ flag, name, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-4 rounded-[14px] border bg-kink-surface px-4 py-4 transition ${
        selected ? "border-kink-gold" : "border-kink-line-gold hover:border-kink-gold/60"
      }`}
    >
      <span className="text-[26px] leading-none" aria-hidden>
        {flag}
      </span>
      <span className="flex-1 text-left text-[19px] sm:text-[22px] font-semibold text-kink-cream">
        {name}
      </span>
      <span
        className={`h-7 w-7 rounded-full border-2 ${
          selected
            ? "border-kink-gold bg-kink-gold [box-shadow:inset_0_0_0_5px_#050404]"
            : "border-kink-amber/80"
        }`}
        aria-hidden
      />
    </button>
  );
}
