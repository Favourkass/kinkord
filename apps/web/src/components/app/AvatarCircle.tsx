import { UserIcon } from "./icons";

export interface AvatarCircleProps {
  src: string | null;
  alt: string;
  /** Photo diameter in px; the ring adds 1px around it. */
  size: number;
  /** Tailwind class for the ring color, e.g. "bg-[#464242]" or "bg-kink-gold-bright". */
  ringClassName?: string;
}

/** Circular avatar on a slightly larger colored ring, with an icon fallback. */
export default function AvatarCircle({ src, alt, size, ringClassName }: AvatarCircleProps) {
  const ring = size + 2;
  return (
    <span
      className={`grid place-items-center rounded-full ${ringClassName ?? "bg-[#464242]"}`}
      style={{ width: ring, height: ring }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="grid place-items-center rounded-full bg-app-input text-app-subtle"
          style={{ width: size, height: size }}
        >
          <UserIcon size={Math.round(size * 0.55)} />
        </span>
      )}
    </span>
  );
}
