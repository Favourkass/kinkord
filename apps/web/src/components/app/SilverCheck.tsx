import Image from "next/image";

/**
 * The Silver shield beside a member's name, the way X shows its check for
 * Premium. Its name is the product's, the same on every screen. (Identity
 * verification gets a mark of its own.)
 */
export default function SilverCheck({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/app/subscription/silver-shield.png"
      alt="Silver Premium"
      title="Silver Premium"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
