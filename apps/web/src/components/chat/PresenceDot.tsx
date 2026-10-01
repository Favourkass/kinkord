export interface PresenceDotProps {
  online: boolean;
  /** Rendered for screen readers — the dot itself is decorative. */
  label: string;
  className?: string;
}

export default function PresenceDot({ online, label, className = "" }: PresenceDotProps) {
  if (!online) return null;
  return (
    <span
      role="img"
      aria-label={label}
      className={`block size-[10px] rounded-full border-2 border-app-surface bg-app-online ${className}`}
    />
  );
}
