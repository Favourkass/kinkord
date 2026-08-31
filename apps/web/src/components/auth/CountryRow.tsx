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
        selected
          ? "border-kink-gold-bright"
          : "border-kink-line-gold hover:border-kink-gold-bright/60"
      }`}
    >
      <span className="text-[26px] leading-none" aria-hidden>
        {flag}
      </span>
      <span className="flex-1 text-left text-[15px] font-semibold text-kink-cream lg:text-[22px]">
        {name}
      </span>
      <span
        className={`h-7 w-7 rounded-full border-2 ${
          selected
            ? "border-kink-gold-bright bg-kink-gold-bright [box-shadow:inset_0_0_0_5px_#000000]"
            : "border-kink-gold-bright/80"
        }`}
        aria-hidden
      />
    </button>
  );
}
