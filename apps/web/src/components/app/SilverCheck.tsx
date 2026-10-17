/** Silver ring indicator for plan descriptions and admin review controls. */
export default function SilverCheck({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Silver Premium"
      title="Silver Premium ring"
      className={`inline-block shrink-0 rounded-full border-[3px] border-[#c6c6c6] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
