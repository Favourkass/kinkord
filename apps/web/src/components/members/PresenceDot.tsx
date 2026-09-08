export interface PresenceDotProps {
  online: boolean;
  /** Accessible name, e.g. "Online" / "Offline". */
  label: string;
  size?: number;
}

/** Green (online) / grey (offline) presence indicator. */
export default function PresenceDot({ online, label, size = 10 }: PresenceDotProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block shrink-0 rounded-full ${online ? "bg-app-online" : "bg-app-offline"}`}
      style={{ width: size, height: size }}
    />
  );
}
