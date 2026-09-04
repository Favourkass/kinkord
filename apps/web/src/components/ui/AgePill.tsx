import { ShieldCheckIcon } from "@/components/auth/AuthIcons";

export interface AgePillProps {
  lead?: string;
  rest: string;
  compact?: boolean;
  className?: string;
}

export default function AgePill({
  lead = "18+ Only.",
  rest,
  compact,
  className = "",
}: AgePillProps) {
  return (
    <div
      role="note"
      aria-label="Age restriction disclaimer"
      className={`flex w-full items-center justify-center gap-2 rounded-[10px] border-[0.5px] border-kink-bronze bg-black/40 backdrop-blur-[2px] ${
        compact ? "px-2.5 py-2 lg:gap-2.5" : "px-3 py-3 lg:gap-3"
      } ${className}`}
    >
      <span
        className={`shrink-0 text-kink-gold-bright ${
          compact ? "[&>svg]:size-5 lg:[&>svg]:size-6" : "[&>svg]:size-6 lg:[&>svg]:size-8"
        }`}
      >
        <ShieldCheckIcon />
      </span>
      <p
        className={`font-medium text-white ${
          compact ? "text-[12px] lg:text-[15px]" : "text-[13px] lg:text-[20px]"
        }`}
      >
        {lead && <span className="text-kink-gold-bright mr-1">{lead}</span>}
        <span>{rest}</span>
      </p>
    </div>
  );
}
