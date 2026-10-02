import type { PostMediaVM } from "@/domain/post";

export interface PostMediaGridProps {
  media: PostMediaVM[];
  onOpen: (media: PostMediaVM) => void;
}

/**
 * Photos under a post. One runs the full card width at the designed 390:238
 * ratio; two to four tile into a square grid, so a post never changes height
 * as the images arrive.
 */
export default function PostMediaGrid({ media, onOpen }: PostMediaGridProps) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    const only = media[0];
    return (
      <button
        type="button"
        onClick={() => onOpen(only)}
        className="mt-[12px] block w-full overflow-hidden rounded-[12px] bg-feed-media"
      >
        <span className="block aspect-[390/238] w-full">
          {only.src && (
            // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable
            <img
              src={only.src}
              alt={only.alt}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          )}
        </span>
      </button>
    );
  }

  return (
    <div
      className={`mt-[12px] grid gap-[4px] overflow-hidden rounded-[12px] ${
        media.length === 2 ? "grid-cols-2" : "grid-cols-2"
      }`}
    >
      {media.map((m, i) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onOpen(m)}
          className={`block overflow-hidden bg-feed-media ${
            // Three photos read best as one tall tile beside two stacked ones.
            media.length === 3 && i === 0 ? "row-span-2" : ""
          }`}
        >
          <span
            className={`block w-full ${media.length === 3 && i === 0 ? "aspect-[1/2.02]" : "aspect-square"}`}
          >
            {m.src && (
              // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable
              <img
                src={m.src}
                alt={m.alt}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
