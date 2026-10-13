export interface OrganizationBadgeProps {
  label: string;
  verified: boolean;
  verifiedLabel: string;
  markSize?: number;
}

/**
 * The official Kinkord account's own mark: one "Official" pill with a check.
 * Deliberately unlike the gold seal members earn by verifying their identity,
 * so the two never read as the same thing. Display only; classification stays
 * in presenters.
 */
export default function OrganizationBadge({
  label,
  verified,
  verifiedLabel,
  markSize = 10,
}: OrganizationBadgeProps) {
  return (
    <span className="inline-flex shrink-0 items-center gap-[3px] rounded-full bg-kink-gold-bright/15 px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.4px] text-kink-gold-bright">
      {verified ? (
        <svg
          role="img"
          aria-label={verifiedLabel}
          width={markSize}
          height={markSize}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>{verifiedLabel}</title>
          <path d="M2.5 6.5 5 9l4.5-6" />
        </svg>
      ) : null}
      {label}
    </span>
  );
}
