import VerifiedMark from "@/components/brand/VerifiedMark";

export interface OrganizationBadgeProps {
  label: string;
  verified: boolean;
  verifiedLabel: string;
  markSize?: number;
}

/** Display-only organization identity marks; classification stays in presenters. */
export default function OrganizationBadge({
  label,
  verified,
  verifiedLabel,
  markSize = 14,
}: OrganizationBadgeProps) {
  return (
    <span className="inline-flex shrink-0 items-center gap-[5px]">
      {verified ? (
        <span title={verifiedLabel} aria-label={verifiedLabel}>
          <VerifiedMark size={markSize} />
        </span>
      ) : null}
      <span className="rounded-full bg-kink-gold-bright/15 px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.4px] text-kink-gold-bright">
        {label}
      </span>
    </span>
  );
}
