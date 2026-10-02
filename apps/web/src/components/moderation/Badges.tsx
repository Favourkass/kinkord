export interface BadgesProps {
  badges: string[];
}

/** "Blocked" reads as a warning; anything else (Admin) as a plain label. */
export default function Badges({ badges }: BadgesProps) {
  if (badges.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-[6px]">
      {badges.map((b) => (
        <span
          key={b}
          className={`rounded-full px-[8px] py-[2px] text-[11px] font-bold uppercase tracking-wide ${
            b === "Blocked" ? "bg-app-danger-soft text-app-danger" : "bg-app-input text-app-subtle"
          }`}
        >
          {b}
        </span>
      ))}
    </span>
  );
}
