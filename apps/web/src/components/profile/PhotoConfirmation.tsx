import { Check } from "lucide-react";

export interface PhotoConfirmationProps {
  title: string;
  intro: string;
  affirmation: string;
  requirements: readonly string[];
  warning: string;
  confirmLabel: string;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  disabled?: boolean;
}

/** Shared, display-only confirmation panel for every profile-photo upload screen. */
export default function PhotoConfirmation({
  title,
  intro,
  affirmation,
  requirements,
  warning,
  confirmLabel,
  confirmed,
  onConfirmedChange,
  disabled = false,
}: PhotoConfirmationProps) {
  return (
    <section
      aria-labelledby="photo-confirmation-title"
      className="w-full rounded-[18px] border border-kink-gold-bright/50 bg-[#181818] p-[16px] text-white shadow-[0_0_28px_rgba(255,186,31,0.08)] sm:p-[20px]"
    >
      <h2
        id="photo-confirmation-title"
        className="text-[14px] font-extrabold leading-snug text-kink-gold-bright sm:text-[16px]"
      >
        {title}
      </h2>
      <p className="mt-[12px] text-[12px] leading-relaxed text-kink-cream sm:text-[14px]">
        {intro}
      </p>
      <p className="mt-[16px] text-[13px] font-bold text-white sm:text-[14px]">{affirmation}</p>
      <ul className="mt-[8px] list-disc space-y-[8px] pl-[20px] text-[12px] leading-relaxed text-kink-cream sm:text-[13px]">
        {requirements.map((requirement) => (
          <li key={requirement}>{requirement}</li>
        ))}
      </ul>
      <p className="mt-[16px] text-[12px] font-semibold leading-relaxed text-kink-cream sm:text-[13px]">
        {warning}
      </p>
      <label
        className={`mt-[18px] flex select-none items-center gap-[10px] rounded-[12px] border px-[14px] py-[12px] transition ${
          disabled
            ? "cursor-not-allowed border-white/10 opacity-60"
            : "cursor-pointer border-kink-gold-bright/40 hover:border-kink-gold-bright"
        }`}
      >
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled}
          onChange={(event) => onConfirmedChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={`grid size-[22px] shrink-0 place-items-center rounded-[5px] border-2 ${
            confirmed
              ? "border-kink-gold-bright bg-kink-gold-bright"
              : "border-kink-gold-bright bg-transparent"
          }`}
        >
          {confirmed ? <Check size={15} strokeWidth={3.5} className="text-black" /> : null}
        </span>
        <span className="text-[13px] font-bold text-white sm:text-[15px]">{confirmLabel}</span>
      </label>
    </section>
  );
}
