export interface PresenceDotProps {
  online: boolean;
  status?: "online" | "away" | "offline";
  /** Rendered for screen readers — the dot itself is decorative. */
  label: string;
  className?: string;
}

export default function PresenceDot({ online, status, label, className = "" }: PresenceDotProps) {
  if (!status && !online) return null;
  const color =
    (status ?? "online") === "online"
      ? "bg-app-online"
      : status === "away"
        ? "bg-amber-400"
        : "bg-app-muted";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`block size-[10px] rounded-full border-2 border-app-surface ${color} ${className}`}
    />
  );
}
