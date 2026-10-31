/**
 * The install card. The still (the finished card, 22 KB) shows at once; the motion is
 * the card's animation as a short looping H.264 video (250 kbps, 203 KB, every frame
 * of the 551 KB animated WebP it replaced), which plays as soon as it starts arriving.
 */
export const PWA_INSTALL_ARTWORK = {
  still: "/brand/kinkord-install-still.webp",
  motion: "/brand/kinkord-install.mp4",
  alt: "Install Kinkord App — get the full experience",
  width: 492,
  height: 576,
} as const;
