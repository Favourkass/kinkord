import MaskIcon from "@/components/app/MaskIcon";

export interface EditNavBarProps {
  title: string;
  backLabel: string;
  onBack: () => void;
  className?: string;
}

/** Figma 1542:334 NavBar: 51px, hairline, back icon-circle and the gold "Edit Profile" title. */
export default function EditNavBar({ title, backLabel, onBack, className }: EditNavBarProps) {
  return (
    <header
      className={`flex h-[51px] shrink-0 items-center border-b border-pf-border bg-pf-nav px-[16px] ${className ?? ""}`}
    >
      <button
        type="button"
        aria-label={backLabel}
        onClick={onBack}
        className="grid size-[32px] shrink-0 place-items-center rounded-[20px] border border-pf-border bg-pf-surface text-pf-icon"
      >
        <MaskIcon src="/app/profile/icon-chevron-left-small.svg" width={16} />
      </button>
      <p className="flex-1 pr-[32px] text-center text-[22px] font-black tracking-[0.88px] text-kink-gold-bright">
        {title}
      </p>
    </header>
  );
}
