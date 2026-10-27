export interface WordmarkImage {
  src: string;
  /** One frame of the animation, for members whose device asks for reduced motion. */
  still?: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * The animated wordmark, already cropped to what shows. A member who has asked
 * their device for reduced motion sees a still frame instead.
 */
export default function AnimatedWordmark({
  image,
  className = "",
}: {
  image: WordmarkImage;
  className?: string;
}) {
  return (
    <picture className={`block ${className}`}>
      {image.still ? (
        <source media="(prefers-reduced-motion: reduce)" srcSet={image.still} />
      ) : null}
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        decoding="async"
        className="block h-auto w-full"
      />
    </picture>
  );
}
