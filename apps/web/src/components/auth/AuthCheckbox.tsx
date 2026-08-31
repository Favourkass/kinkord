"use client";

interface AuthCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function AuthCheckbox({ label, checked, onChange }: AuthCheckboxProps) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 lg:gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border-2 lg:size-[22px] ${
          checked ? "border-kink-gold-bright bg-kink-gold-bright" : "border-white bg-transparent"
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2 6.5L4.5 9L10 3.5"
              stroke="black"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="text-[15px] font-light text-white lg:text-[20px]">{label}</span>
    </label>
  );
}
