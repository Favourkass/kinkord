import Image from "next/image";

export interface InstallArtwork {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** Shows the complete animated card while framing out the source GIF's blank margins. */
export function PwaInstallArtwork({ artwork }: { artwork: InstallArtwork }) {
  return (
    <span className="relative block aspect-[41/48] w-full overflow-hidden rounded-2xl bg-black">
      <Image
        {...artwork}
        alt={artwork.alt}
        unoptimized
        loading="eager"
        className="absolute left-1/2 top-1/2 h-auto w-[109.7561%] max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  );
}
