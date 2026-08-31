"use client";

interface Props {
  options: readonly string[];
  selected: string[];
  onToggle: (role: string) => void;
  max?: number;
}

/** Multi-select role chips for Build Your Profile. */
export default function RoleChips({ options, selected, onToggle, max = 10 }: Props) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((role) => {
        const on = selected.includes(role);
        const full = !on && selected.length >= max;
        return (
          <button
            key={role}
            type="button"
            aria-pressed={on}
            disabled={full}
            onClick={() => onToggle(role)}
            className={`rounded-full border px-4 py-2 text-[14px] font-semibold transition disabled:opacity-30 ${
              on
                ? "border-kink-gold-bright bg-kink-gold-bright text-black"
                : "border-kink-edge bg-kink-field text-kink-cream hover:border-kink-gold-bright/60"
            }`}
          >
            {role}
          </button>
        );
      })}
    </div>
  );
}
