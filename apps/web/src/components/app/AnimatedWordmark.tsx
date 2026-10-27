import Image from "next/image";

export interface WordmarkImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** Frames the supplied 1280×720 animation around its central wordmark without changing the GIF. */
export default function AnimatedWordmark({
  image,
  className = "",
}: {
  image: WordmarkImage;
  className?: string;
}) {
  return (
    <span className={`relative block aspect-[19/6] overflow-hidden ${className}`}>
      <Image
        {...image}
        alt={image.alt}
        unoptimized
        loading="eager"
        className="absolute left-1/2 top-1/2 h-auto w-[210.5263%] max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  );
}
