import Image from "next/image";
import { Landmark } from "lucide-react";
export default function BankLogo({
  src,
  className = "size-12",
}: {
  src: string | null;
  className?: string;
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-app-card-border ${className}`}
    >
      <Landmark size={23} className="text-app-members-count" aria-hidden="true" />
      {src && (
        <Image
          src={src}
          alt=""
          width={64}
          height={64}
          unoptimized
          loading="lazy"
          className="absolute inset-0 size-full object-contain"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}
