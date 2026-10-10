import { BadgeCheck } from "lucide-react";

/** Basic verification is separate from the Silver subscription shield. */
export default function VerifiedCheck({ label, size = 15 }: { label: string; size?: number }) {
  return (
    <BadgeCheck
      size={size}
      fill="currentColor"
      stroke="var(--app-surface)"
      className="shrink-0 text-kink-gold-bright"
      role="img"
      aria-label={label}
    />
  );
}
