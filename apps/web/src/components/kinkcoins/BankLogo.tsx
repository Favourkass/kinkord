/** A bank's initials on its colour, where a logo would go (as on the Silver payment page). */
export default function BankLogo({
  badge,
  className = "size-12 text-xs",
}: {
  badge: { text: string; colour: string };
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-xl font-bold text-white ${className}`}
      style={{ backgroundColor: badge.colour }}
    >
      {badge.text}
    </span>
  );
}
