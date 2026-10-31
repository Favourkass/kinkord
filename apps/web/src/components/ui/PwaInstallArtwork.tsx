"use client";

import Image from "next/image";
import { useState } from "react";

export interface InstallArtwork {
  /** The finished card: shown at once, and on its own where there's no motion. */
  still: string;
  /** The card's motion, a short looping video. Null shows the still alone. */
  motion: string | null;
  alt: string;
  width: number;
  height: number;
}

/**
 * The install card. The still shows straight away, so a slow network never leaves a
 * blank screen; the motion plays underneath and the still fades out once it's playing.
 */
export function PwaInstallArtwork({ artwork }: { artwork: InstallArtwork }) {
  const [playing, setPlaying] = useState(false);
  return (
    <span className="relative block w-full overflow-hidden rounded-2xl bg-black">
      {artwork.motion ? (
        // Decorative and muted: the still underneath carries the description.
        <video
          src={artwork.motion}
          width={artwork.width}
          height={artwork.height}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onPlaying={() => setPlaying(true)}
          className="absolute inset-0 block h-full w-full"
        />
      ) : null}
      <Image
        src={artwork.still}
        alt={artwork.alt}
        width={artwork.width}
        height={artwork.height}
        unoptimized
        loading="eager"
        className={`relative block h-auto w-full transition-opacity duration-300 ${playing && artwork.motion ? "opacity-0" : "opacity-100"}`}
      />
    </span>
  );
}
