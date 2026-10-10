interface VerifiedMarkProps {
  size?: number;
  className?: string;
}

/** Kinkord's gold verified seal. Decorative: the text beside it says what it means. */
export default function VerifiedMark({ size = 20, className }: VerifiedMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small local brand mark with explicit dimensions.
    <img
      src="/brand/kinkord-verified-v1.webp"
      width={size}
      height={size}
      alt=""
      className={`inline-block shrink-0 object-contain ${className ?? ""}`}
    />
  );
}
