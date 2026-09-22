interface KycVerifiedMarkProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Official Kinkord KYC seal extracted from the supplied brand artwork. */
export default function KycVerifiedMark({
  size = 20,
  className,
  label = "Kinkord KYC verified",
}: KycVerifiedMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- transparent local brand mark; dimensions are explicit.
    <img
      src="/brand/kinkord-kyc-verified-badge-v1.png"
      width={size}
      height={size}
      alt={label}
      className={`inline-block shrink-0 object-contain ${className ?? ""}`}
    />
  );
}
