import Image from "next/image";

export interface TeamBadgeProps {
  size?: number;
  className?: string;
}

/** A public Kinkord team identity, separate from paid/identity verification. */
export default function TeamBadge({ size = 20, className = "" }: TeamBadgeProps) {
  return (
    <span
      role="img"
      aria-label="Kinkord Team member"
      title="Kinkord Team member — assigned by a Kinkord admin"
      className={`inline-flex shrink-0 self-center align-middle ${className}`}
    >
      <Image
        src="/brand/kinkord-team-badge.png"
        alt=""
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size * 0.8, height: size * 0.8 }}
      />
    </span>
  );
}
