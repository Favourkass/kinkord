export interface InstallArtwork {
  src: string;
  /** One frame of the animation, for members whose device asks for reduced motion. */
  still?: string;
  alt: string;
  width: number;
  height: number;
}

/** The animated install card, already cropped to the card. Reduced motion gets a still. */
export function PwaInstallArtwork({ artwork }: { artwork: InstallArtwork }) {
  return (
    <picture className="block w-full overflow-hidden rounded-2xl bg-black">
      {artwork.still ? (
        <source media="(prefers-reduced-motion: reduce)" srcSet={artwork.still} />
      ) : null}
      <img
        src={artwork.src}
        alt={artwork.alt}
        width={artwork.width}
        height={artwork.height}
        decoding="async"
        className="block h-auto w-full"
      />
    </picture>
  );
}
