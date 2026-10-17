import { UserIcon } from "./icons";

export interface AvatarCircleProps {
  src: string | null;
  alt: string;
  /** Photo diameter in px; the ring adds 1px around it. */
  size: number;
  /** Tailwind class for the ring color, e.g. "bg-[#464242]" or "bg-kink-gold-bright". */
  ringClassName?: string;
  shape?: "circle" | "square";
  silver?: boolean;
}

/** Circular avatar on a slightly larger colored ring, with an icon fallback. */
export default function AvatarCircle({
  src,
  alt,
  size,
  ringClassName,
  silver = false,
  shape = "circle",
}: AvatarCircleProps) {
  const ring = size + (silver ? 6 : 2);
  const rounding = shape === "square" ? "rounded-[8px]" : "rounded-full";
  return (
    <span
      role={silver ? "img" : undefined}
      aria-label={silver ? "Silver Premium" : undefined}
      title={silver ? "Silver Premium member" : undefined}
      className={`grid place-items-center ${rounding} ${silver ? "bg-gradient-to-br from-[#f5f5f5] via-[#a6a6a6] to-[#e0e0e0]" : (ringClassName ?? "bg-[#464242]")}`}
      style={{ width: ring, height: ring }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          className={`${rounding} bg-app-input object-cover`}
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className={`grid place-items-center ${rounding} bg-app-input text-app-subtle`}
          style={{ width: size, height: size }}
        >
          <UserIcon size={Math.round(size * 0.55)} />
        </span>
      )}
    </span>
  );
}
